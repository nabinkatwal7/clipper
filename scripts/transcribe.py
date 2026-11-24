"""Bounded, batched transcription with atomic resumable checkpoints."""
import json
import os
import sys
import threading
import time
import wave
from pathlib import Path

import numpy as np
from faster_whisper import BatchedInferencePipeline, WhisperModel


def atomic_json(destination, value):
    temporary = str(destination) + '.tmp'
    with open(temporary, 'w', encoding='utf-8') as out:
        json.dump(value, out, ensure_ascii=False)
    for attempt in range(13):
        try:
            os.replace(temporary, destination)
            break
        except PermissionError:
            if attempt == 12:
                raise
            time.sleep(min(0.2, 0.02 * (2 ** attempt)))


def main():
    source, destination = map(Path, sys.argv[1:3])
    checkpoint = Path(str(destination) + '.checkpoint')
    model_name = os.getenv('WHISPER_MODEL', 'tiny')
    beam = max(1, int(os.getenv('WHISPER_BEAM_SIZE', '1')))
    batch = max(1, int(os.getenv('WHISPER_BATCH_SIZE', '8')))
    window = max(30, int(os.getenv('WHISPER_WINDOW_SECONDS', '120')))
    step = window - 5
    fingerprint = {'size': source.stat().st_size, 'modified': source.stat().st_mtime_ns,
                   'model': model_name, 'beam': beam, 'window': window}
    result, resume_frame, last_end = [], 0, 0.0
    try:
        saved = json.loads(checkpoint.read_text(encoding='utf-8'))
        if saved['fingerprint'] == fingerprint:
            result, resume_frame = saved['segments'], saved['next_frame']
            last_end = result[-1]['end'] if result else 0.0
    except (OSError, ValueError, KeyError):
        pass
    state = {'phase': 'loading', 'seconds': resume_frame / 16000}
    lock = threading.Lock()
    finished = threading.Event()

    def emit(**changes):
        with lock:
            state.update(changes)
            print(json.dumps(state), flush=True)

    def heartbeat():
        while not finished.wait(2):
            emit()

    emit()
    threading.Thread(target=heartbeat, daemon=True).start()
    try:
        model = WhisperModel(model_name, device=os.getenv('WHISPER_DEVICE', 'cpu'),
                             compute_type=os.getenv('WHISPER_COMPUTE_TYPE', 'int8'),
                             cpu_threads=max(1, int(os.getenv('WHISPER_CPU_THREADS', str(min(8, os.cpu_count() or 4))))),
                             num_workers=1)
        pipeline = BatchedInferencePipeline(model)
        with wave.open(str(source), 'rb') as audio:
            if (audio.getnchannels(), audio.getframerate(), audio.getsampwidth()) != (1, 16000, 2):
                raise ValueError('Expected mono 16 kHz PCM16 audio')
            rate, total = audio.getframerate(), audio.getnframes()
            for frame in range(resume_frame, total, step * rate):
                audio.setpos(frame)
                samples = np.frombuffer(audio.readframes(window * rate), dtype=np.int16).astype(np.float32) / 32768.0
                offset = frame / rate
                emit(phase='decoding', windowStart=offset,
                     windowEnd=min(total / rate, offset + window), seconds=offset)
                segments, _ = pipeline.transcribe(samples, word_timestamps=True,
                    vad_filter=True, vad_parameters={'min_silence_duration_ms': 500},
                    beam_size=beam, best_of=1, temperature=0,
                    condition_on_previous_text=False, batch_size=batch,
                    language=os.getenv('WHISPER_LANGUAGE') or None)
                for segment in segments:
                    words = [{'start': w.start + offset, 'end': w.end + offset, 'word': w.word}
                             for w in (segment.words or [])
                             if w.end > w.start and w.start + offset >= last_end - 0.05]
                    if words:
                        result.append({'start': words[0]['start'], 'end': words[-1]['end'],
                                       'text': ''.join(w['word'] for w in words).strip(), 'words': words})
                        last_end = words[-1]['end']
                        emit(seconds=last_end)
                next_frame = min(total, frame + step * rate)
                atomic_json(checkpoint, {'fingerprint': fingerprint, 'next_frame': next_frame,
                                         'segments': result})
                emit(phase='checkpoint', seconds=next_frame / rate)
        atomic_json(destination, result)
        checkpoint.unlink(missing_ok=True)
        emit(phase='complete', seconds=total / rate)
    finally:
        finished.set()


if __name__ == '__main__':
    main()
