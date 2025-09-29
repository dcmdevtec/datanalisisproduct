import dynamic from "next/dynamic";
export const AdvancedQuestionConfig = dynamic(() => import("@/components/advanced-question-config").then(m => m.AdvancedQuestionConfig), { ssr: false });
