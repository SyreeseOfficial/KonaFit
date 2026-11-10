import { Alert } from "react-native";

/** One yes/no dialog. Resolves true on the confirm button, false on Cancel or tapping outside (Android). */
export const confirm = ({ title, message, confirmText = "OK", cancelText = "Cancel", destructive = false }: {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: "cancel", onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? "destructive" : "default", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  );
