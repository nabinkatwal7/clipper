"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "@/lib/public-copy";

const words: Record<string, [string, string]> = {
  "in your workspace": ["तपाईंको कार्यक्षेत्रमा", "आपके कार्यक्षेत्र में"],
  "Up to 5 GB": ["५ जीबीसम्म", "५ जीबी तक"],
  "Start or resume a video": [
    "भिडियो सुरु गर्नुहोस् वा फेरि खोल्नुहोस्",
    "वीडियो शुरू करें या फिर से खोलें",
  ],
  "Organize your recordings": ["रेकर्डिङ व्यवस्थित गर्नुहोस्", "रिकॉर्डिंग व्यवस्थित करें"],
  "Find and cut moments": ["मुख्य अंश खोज्नुहोस् र काट्नुहोस्", "खास पल खोजें और काटें"],
  "Edit, caption and design": [
    "सम्पादन, उपशीर्षक र डिजाइन",
    "संपादन, उपशीर्षक और डिज़ाइन",
  ],
  "Browse clips and assets": ["क्लिप र सामग्री हेर्नुहोस्", "क्लिप और सामग्री देखें"],
  "Run and monitor workflows": [
    "कार्यप्रवाह चलाउनुहोस् र निगरानी गर्नुहोस्",
    "वर्कफ़्लो चलाएँ और निगरानी करें",
  ],
  "Review and prepare exports": [
    "समीक्षा र निर्यात तयारी",
    "समीक्षा और निर्यात की तैयारी",
  ],
  "Manage local resources": [
    "स्थानीय स्रोत व्यवस्थापन गर्नुहोस्",
    "स्थानीय संसाधन प्रबंधित करें",
  ],
  "Checking Ollama…": ["Ollama जाँच हुँदैछ…", "Ollama की जाँच हो रही है…"],
  "Ollama connected": ["Ollama जोडिएको छ", "Ollama जुड़ा है"],
  "Ollama unavailable": ["Ollama उपलब्ध छैन", "Ollama उपलब्ध नहीं है"],
  Upload: ["अपलोड", "अपलोड"],
  Queued: ["कार्यसूचीमा", "कतार में"],
  "Project bins": ["परियोजना फोल्डरहरू", "प्रोजेक्ट फ़ोल्डर"],
  "Instant clipping": ["तत्काल क्लिपिङ", "तुरंत क्लिपिंग"],
  Compilations: ["सङ्कलनहरू", "संकलन"],
  "Motion Studio": ["गति स्टुडियो", "मोशन स्टूडियो"],
  "Compositing Studio": ["संयोजन स्टुडियो", "कंपोज़िटिंग स्टूडियो"],
  "Image editor": ["तस्बिर सम्पादक", "इमेज एडिटर"],
  "Thumbnail studio": ["थम्बनेल स्टुडियो", "थंबनेल स्टूडियो"],
  "Review Studio": ["समीक्षा स्टुडियो", "समीक्षा स्टूडियो"],
  "Automatic clipping": ["स्वचालित क्लिपिङ", "स्वचालित क्लिपिंग"],
  "Recording Studio": ["रेकर्डिङ स्टुडियो", "रिकॉर्डिंग स्टूडियो"],
  "Media toolbox": ["मिडिया उपकरण", "मीडिया टूलबॉक्स"],
  "Transcribe audio": ["अडियोको प्रतिलिपि बनाउनुहोस्", "ऑडियो का ट्रांसक्रिप्ट बनाएँ"],
  "Transcription queued": ["प्रतिलिपि कार्यसूचीमा छ", "ट्रांसक्रिप्शन कतार में है"],
  "Transcribe the audio or import a subtitle file to edit by dialogue.": [
    "संवादबाट सम्पादन गर्न अडियोको प्रतिलिपि बनाउनुहोस् वा उपशीर्षक फाइल आयात गर्नुहोस्।",
    "संवाद के आधार पर संपादन करने के लिए ऑडियो का ट्रांसक्रिप्ट बनाएँ या उपशीर्षक फ़ाइल इंपोर्ट करें।",
  ],
  Home: ["गृहपृष्ठ", "होम"],
  Overview: ["अवलोकन", "अवलोकन"],
  Projects: ["परियोजनाहरू", "प्रोजेक्ट"],
  Clipping: ["क्लिप बनाउने", "क्लिप बनाना"],
  Studio: ["स्टुडियो", "स्टूडियो"],
  Library: ["सङ्ग्रह", "लाइब्रेरी"],
  Automation: ["स्वचालन", "ऑटोमेशन"],
  Production: ["प्रकाशन तयारी", "प्रकाशन की तैयारी"],
  Settings: ["सेटिङ", "सेटिंग्स"],
  "Studio overview": ["स्टुडियो अवलोकन", "स्टूडियो अवलोकन"],
  "New project": ["नयाँ परियोजना", "नया प्रोजेक्ट"],
  "Import a video": ["भिडियो आयात गर्नुहोस्", "वीडियो इंपोर्ट करें"],
  "Upload a file": ["फाइल अपलोड गर्नुहोस्", "फ़ाइल अपलोड करें"],
  "Paste a video link": ["भिडियोको लिङ्क टाँस्नुहोस्", "वीडियो लिंक पेस्ट करें"],
  "Find highlights in a stream or recording.": [
    "स्ट्रिम वा रेकर्डिङका मुख्य अंश खोज्नुहोस्।",
    "स्ट्रीम या रिकॉर्डिंग के खास पल खोजें।",
  ],
  "Clip a live stream": [
    "लाइभ स्ट्रिमको क्लिप बनाउनुहोस्",
    "लाइव स्ट्रीम से क्लिप बनाएँ",
  ],
  "Browse clips": ["क्लिपहरू हेर्नुहोस्", "क्लिप देखें"],
  "Last edited project": ["पछिल्लो सम्पादित परियोजना", "पिछला संपादित प्रोजेक्ट"],
  "Recent projects": ["हालका परियोजनाहरू", "हाल के प्रोजेक्ट"],
  "All projects": ["सबै परियोजनाहरू", "सभी प्रोजेक्ट"],
  "Recent clips": ["हालका क्लिपहरू", "हाल की क्लिप"],
  "Open library": ["सङ्ग्रह खोल्नुहोस्", "लाइब्रेरी खोलें"],
  "Processing now": ["अहिले प्रशोधन हुँदैछ", "अभी प्रोसेस हो रहा है"],
  "View queue": ["कार्यसूची हेर्नुहोस्", "कतार देखें"],
  "Search studio": ["स्टुडियोमा खोज्नुहोस्", "स्टूडियो में खोजें"],
  "Search pages, commands, projects and clips": [
    "पृष्ठ, आदेश, परियोजना र क्लिप खोज्नुहोस्",
    "पेज, कमांड, प्रोजेक्ट और क्लिप खोजें",
  ],
  "Account menu": ["खाता मेनु", "खाता मेनू"],
  "Account settings": ["खाता सेटिङ", "खाता सेटिंग्स"],
  "Sign out": ["साइन आउट", "साइन आउट"],
  "Interface language": ["इन्टरफेसको भाषा", "इंटरफ़ेस की भाषा"],
  "Generate clips": ["क्लिप बनाउनुहोस्", "क्लिप बनाएँ"],
  "Create more clips": ["थप क्लिप बनाउनुहोस्", "और क्लिप बनाएँ"],
  "Quick clip settings": ["द्रुत क्लिप सेटिङ", "त्वरित क्लिप सेटिंग्स"],
  "Advanced project settings": ["उन्नत परियोजना सेटिङ", "उन्नत प्रोजेक्ट सेटिंग्स"],
  "Burn available subtitles into clips": [
    "उपलब्ध उपशीर्षक क्लिपमा राख्नुहोस्",
    "उपलब्ध उपशीर्षक क्लिप में जोड़ें",
  ],
  "Video link": ["भिडियो लिङ्क", "वीडियो लिंक"],
  "Upload file": ["फाइल अपलोड", "फ़ाइल अपलोड"],
  "Clip length": ["क्लिपको अवधि", "क्लिप की अवधि"],
  "How many clips?": ["कति क्लिप?", "कितनी क्लिप?"],
  seconds: ["सेकेन्ड", "सेकंड"],
  clips: ["क्लिप", "क्लिप"],
  projects: ["परियोजना", "प्रोजेक्ट"],
  "Let AI decide": ["एआईलाई छान्न दिनुहोस्", "एआई को तय करने दें"],
  "Find a project": ["परियोजना खोज्नुहोस्", "प्रोजेक्ट खोजें"],
  "All statuses": ["सबै अवस्थाहरू", "सभी स्थितियाँ"],
  Ready: ["तयार", "तैयार"],
  Processing: ["प्रशोधन हुँदैछ", "प्रोसेस हो रहा है"],
  Cancelled: ["रद्द", "रद्द"],
  "Needs attention": ["ध्यान आवश्यक", "ध्यान दें"],
  "Clear filters": ["फिल्टर हटाउनुहोस्", "फ़िल्टर हटाएँ"],
  "Video editor": ["भिडियो सम्पादक", "वीडियो एडिटर"],
  "Video Studio": ["भिडियो स्टुडियो", "वीडियो स्टूडियो"],
  "Clip library": ["क्लिप सङ्ग्रह", "क्लिप लाइब्रेरी"],
  Assets: ["मिडिया सामग्री", "मीडिया सामग्री"],
  "Asset library": ["मिडिया सङ्ग्रह", "मीडिया लाइब्रेरी"],
  Discover: ["खोज्नुहोस्", "खोजें"],
  "Live clipping": ["लाइभ क्लिपिङ", "लाइव क्लिपिंग"],
  "Transcript Studio": ["प्रतिलिपि स्टुडियो", "ट्रांसक्रिप्ट स्टूडियो"],
  "Transcript explorer": ["प्रतिलिपि खोज्नुहोस्", "ट्रांसक्रिप्ट देखें"],
  "Subtitle studio": ["उपशीर्षक स्टुडियो", "उपशीर्षक स्टूडियो"],
  "Processing queue": ["प्रशोधन कार्यसूची", "प्रोसेसिंग कतार"],
  "Content calendar": ["सामग्री पात्रो", "सामग्री कैलेंडर"],
  Storage: ["भण्डारण", "स्टोरेज"],
  "Backup & recovery": ["ब्याकअप र पुनःस्थापना", "बैकअप और रिकवरी"],
  "Production desk": ["प्रकाशन कार्यक्षेत्र", "प्रकाशन कार्यक्षेत्र"],
  Branding: ["ब्रान्डिङ", "ब्रांडिंग"],
  "Workflow builder": ["कार्यप्रवाह बनाउनुहोस्", "वर्कफ़्लो बनाएँ"],
  "Local engine": ["स्थानीय इन्जिन", "स्थानीय इंजन"],
  "Change theme": ["थिम बदल्नुहोस्", "थीम बदलें"],
  Navigation: ["नेभिगेसन", "नेविगेशन"],
};

const StudioLocale = createContext<Locale>("en");
export function StudioLocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <StudioLocale.Provider value={locale}>{children}</StudioLocale.Provider>
  );
}
export function useStudioLocale() {
  const locale = useContext(StudioLocale);
  return {
    locale,
    t: (text: string) =>
      locale === "en" ? text : words[text]?.[locale === "ne" ? 0 : 1] || text,
  };
}
export function chooseStudioLocale(locale: Locale) {
  document.cookie =
    "studio_locale=" + locale + "; Path=/; SameSite=Strict; Max-Age=31536000";
  location.reload();
}
