import { forwardRef } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, className, ...props },
  ref
) {
  return (
    <View className="mb-4">
      {label ? <Text className="mb-1.5 text-sm font-medium text-gray-600">{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor="#9ca3af"
        className={`rounded-xl border px-4 py-3.5 text-base text-gray-900 ${
          error ? 'border-red-400' : 'border-gray-200'
        } ${className ?? ''}`}
        {...props}
      />
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
});
