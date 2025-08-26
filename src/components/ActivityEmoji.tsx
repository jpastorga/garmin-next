"use client";

import Twemoji from "react-twemoji";

interface Activity {
  type: string | null;
  sport_type?: string | null;
}

interface ActivityEmojiProps {
  activity: Activity;
  size?: string;
  className?: string;
}

const getActivityEmoji = (activity: Activity): string => {
  const type = activity.sport_type || activity.type || "";

  const typeMap: Record<string, string> = {
    // Running
    Run: "🏃‍♂️",
    VirtualRun: "🏃‍♂️",
    TrailRun: "🏃‍♂️",

    // Cycling
    Ride: "🚴‍♂️",
    VirtualRide: "🚴‍♂️",
    MountainBikeRide: "🚵‍♂️",
    GravelRide: "🚴‍♂️",
    EBikeRide: "🚴‍♂️",

    // Swimming
    Swim: "🏊‍♂️",
    VirtualSwim: "🏊‍♂️",

    // Walking/Hiking
    Walk: "🚶‍♂️",
    Hike: "🥾",
    VirtualWalk: "🚶‍♂️",

    // Winter Sports
    AlpineSki: "⛷️",
    BackcountrySki: "⛷️",
    Snowboard: "🏂",
    Snowshoe: "⛷️",
    IceSkate: "⛸️",

    // Water Sports
    Kayaking: "🛶",
    Canoeing: "🛶",
    Kitesurf: "🪁",
    Windsurf: "🏄‍♂️",
    Surf: "🏄‍♂️",
    StandUpPaddling: "🏄‍♂️",

    // Gym/Indoor
    WeightTraining: "🏋️‍♂️",
    Workout: "💪",
    Crossfit: "🏋️‍♂️",
    Yoga: "🧘‍♂️",
    Pilates: "🧘‍♀️",
    StairStepper: "🏃‍♂️",
    Elliptical: "🏃‍♂️",

    // Ball sports
    Soccer: "⚽",
    Basketball: "🏀",
    Tennis: "🎾",
    Golf: "🏌️‍♂️",
    Badminton: "🏸",
    BadmintonGame: "🏸",

    // Other
    RockClimbing: "🧗‍♂️",
    InlineSkate: "🛼",
    Skateboard: "🛹",
  };

  return typeMap[type.trim()] || "🏃‍♂️";
};

export default function ActivityEmoji({
  activity,
  size = "1.2em",
  className = "",
}: ActivityEmojiProps) {
  const emoji = getActivityEmoji(activity);

  return (
    <Twemoji
      options={{
        className: `twemoji ${className}`,
        folder: "svg",
        ext: ".svg",
        base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
      }}
    >
      <span
        style={{ fontSize: size }}
        role="img"
        aria-label={`${activity.sport_type || activity.type || "Activity"} emoji`}
      >
        {emoji}
      </span>
    </Twemoji>
  );
}
