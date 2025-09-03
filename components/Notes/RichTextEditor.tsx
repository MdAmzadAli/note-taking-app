
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputSelectionChangeEventData,
  Text,
  Platform,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Dimensions } from 'react-native';

interface RichTextEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  style?: any;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  fontSize: number;
  textColor: string;
  fontFamily: string;
}

interface TextFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  highlight: boolean;
  color: string;
  fontSize: number;
}

export default function RichTextEditor({
  value,
  onChangeText,
  placeholder = '',
  placeholderTextColor = '#888888',
  style,
  onSelectionChange,
  fontSize,
  textColor,
  fontFamily,
}: RichTextEditorProps) {
  const [htmlContent, setHtmlContent] = useState('');
  const [currentFormat, setCurrentFormat] = useState<TextFormat>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    highlight: false,
    color: textColor,
    fontSize: fontSize,
  });
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const textInputRef = useRef<TextInput>(null);

  useEffect(() => {
    setCurrentFormat(prev => ({
      ...prev,
      color: textColor,
      fontSize: fontSize,
    }));
  }, [textColor, fontSize]);

  const convertTextToHtml = (text: string): string => {
    if (!text) return '';
    
    // Simple conversion - this is a basic implementation
    // In a production app, you'd use a more sophisticated HTML converter
    let html = text
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/__(.*?)__/g, '<u>$1</u>')
      .replace(/~~(.*?)~~/g, '<s>$1</s>');
    
    return `<div style="font-family: ${fontFamily}; font-size: ${fontSize}px; color: ${textColor};">${html}</div>`;
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    setHtmlContent(convertTextToHtml(text));
  };

  const handleSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const { start, end } = event.nativeEvent.selection;
    setSelection({ start, end });
    onSelectionChange?.({ start, end });
  };

  const applyFormatting = (formatType: keyof TextFormat, value?: any) => {
    const selectedText = value.substring(selection.start, selection.end);
    if (!selectedText) return;

    let formattedText = value;
    const beforeText = value.substring(0, selection.start);
    const afterText = value.substring(selection.end);

    switch (formatType) {
      case 'bold':
        formattedText = beforeText + `**${selectedText}**` + afterText;
        break;
      case 'italic':
        formattedText = beforeText + `*${selectedText}*` + afterText;
        break;
      case 'underline':
        formattedText = beforeText + `__${selectedText}__` + afterText;
        break;
      case 'strikethrough':
        formattedText = beforeText + `~~${selectedText}~~` + afterText;
        break;
    }

    handleTextChange(formattedText);
  };

  const insertLink = (url: string, displayText?: string) => {
    const linkText = displayText || url;
    const beforeText = value.substring(0, selection.start);
    const afterText = value.substring(selection.end);
    const newText = beforeText + `[${linkText}](${url})` + afterText;
    handleTextChange(newText);
  };

  return (
    <View style={style}>
      <TextInput
        ref={textInputRef}
        style={[
          styles.textInput,
          {
            fontSize: fontSize,
            color: textColor,
            fontFamily: fontFamily,
          },
        ]}
        value={value}
        onChangeText={handleTextChange}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  textInput: {
    flex: 1,
    textAlignVertical: 'top',
  },
});

export { RichTextEditor };
