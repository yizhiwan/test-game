/**
 * Server shell for the ending routes. See the room route for why.
 */

import EndingView from "./EndingView";
import type { EndingType } from "@/lib/types";

const ENDING_TYPES: EndingType[] = [
  "win_murder",
  "win_escape",
  "lose_wrong",
  "lose_time",
];

export function generateStaticParams() {
  return ENDING_TYPES.map((type) => ({ type }));
}

export const dynamicParams = false;

export default function EndingPage() {
  return <EndingView />;
}
