/**
 * Server shell for the room route.
 *
 * The view itself is a client component; this wrapper exists so the route can
 * declare its params for `output: "export"`, which a "use client" file cannot do.
 */

import RoomView from "./RoomView";

export function generateStaticParams() {
  return [{ id: "lab404" }];
}

export const dynamicParams = false;

export default function RoomPage() {
  return <RoomView />;
}
