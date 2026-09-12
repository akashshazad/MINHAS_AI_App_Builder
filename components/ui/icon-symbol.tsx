
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "folder.fill": "folder",
  "gearshape.fill": "settings",
  "doc.text.fill": "description",
  "sparkles": "auto-awesome",
  "play.fill": "play-arrow",
  "checkmark.circle.fill": "check-circle",
  "exclamationmark.triangle.fill": "warning",
  "person.circle.fill": "account-circle",
  "arrow.up.right.square": "open-in-new",
  "plus": "add",
  "bot.fill": "smart-toy",
  "photo.fill": "image",
  "iphone": "phone-iphone",
  "rectangle.stack.fill": "view-carousel",
  "gamecontroller.fill": "sports-esports",
  "globe": "language",
  "doc.magnifyingglass": "manage-search",
  "book.fill": "menu-book",
  "wand.and.stars": "auto-fix-high",
  "mic.fill": "mic",
  "magnifyingglass": "search",
} as unknown as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}


