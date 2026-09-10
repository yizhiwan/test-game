/**
 * Server shell for the interrogation route. See the room route for why.
 */

import DialogueView from "./DialogueView";
import { NPC_LIST } from "@/lib/caseData";

export function generateStaticParams() {
  return NPC_LIST.map((npc) => ({ id: "lab404", npcId: npc.id }));
}

export const dynamicParams = false;

export default function DialoguePage() {
  return <DialogueView />;
}
