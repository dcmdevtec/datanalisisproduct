// Recuerda: importa el CSS de emoji-mart en tu archivo global, por ejemplo en app/globals.css:
// @import 'emoji-mart/css/emoji-mart.css';

import React, { useEffect, useRef } from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClickOutside?: () => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClickOutside }) => {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClickOutside && onClickOutside();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClickOutside]);

  return (
    <div ref={pickerRef} style={{ zIndex: 9999, position: "relative" }} className="z-50">
      <Picker
        data={data}
        onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
        previewPosition="none"
        skinTonePosition="none"
        perLine={8}
        maxFrequentRows={0}
        navPosition="top"
        searchPosition="none"
        emojiButtonSize={36}
        emojiSize={28}
        style={{ width: 320 }}
      />
    </div>
  );
};

export default EmojiPicker;
