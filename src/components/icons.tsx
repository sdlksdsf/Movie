import type { SVGProps } from "react";

type Icon = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const SearchIcon: Icon = (props) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const BellIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
    <path d="M10.3 20a2 2 0 0 0 3.4 0" />
  </svg>
);

export const PlusIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const CheckIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="m4 12.5 5 5L20 6.5" />
  </svg>
);

export const ThumbUpIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M7 21V9.6l4.4-6.1a2 2 0 0 1 3.5 1.2L14.3 9H20a2 2 0 0 1 2 2.35l-1.4 7A2 2 0 0 1 18.6 20H7z" />
    <path d="M7 9H3v12h4" />
  </svg>
);

export const ChevronDownIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronLeftIcon: Icon = (props) => (
  <svg {...base(props)} strokeWidth={2.6}>
    <path d="m15 5-7 7 7 7" />
  </svg>
);

export const ChevronRightIcon: Icon = (props) => (
  <svg {...base(props)} strokeWidth={2.6}>
    <path d="m9 5 7 7-7 7" />
  </svg>
);

export const CloseIcon: Icon = (props) => (
  <svg {...base(props)} strokeWidth={2.2}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const InfoIcon: Icon = (props) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export const PlayIcon: Icon = (props) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);

export const ArrowLeftIcon: Icon = (props) => (
  <svg {...base(props)} strokeWidth={2.2}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </svg>
);

export const VolumeIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
    <path d="M16 8.5a4.5 4.5 0 0 1 0 7" />
    <path d="M18.5 6a8 8 0 0 1 0 12" />
  </svg>
);

export const MuteIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M4 9.5h3L12 5v14l-5-4.5H4z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);

export const FullscreenIcon: Icon = (props) => (
  <svg {...base(props)} strokeWidth={1.8}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const SubtitlesIcon: Icon = (props) => (
  <svg {...base(props)}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 15h4M13 15h4M7 11h2M11 11h6" />
  </svg>
);

export const NextIcon: Icon = (props) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <path d="M5 4.7v14.6a.8.8 0 0 0 1.23.67l10.2-7.3a.8.8 0 0 0 0-1.34L6.23 4.03A.8.8 0 0 0 5 4.7z" />
    <rect x="18" y="4" width="2.2" height="16" rx="1" />
  </svg>
);

export const PauseIcon: Icon = (props) => (
  <svg {...base(props)} fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4.2" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.2" height="16" rx="1.2" />
  </svg>
);

export const RewindIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M3 12a9 9 0 1 0 3.2-6.9" />
    <path d="M3 4v5h5" />
  </svg>
);

export const ForwardIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M21 12a9 9 0 1 1-3.2-6.9" />
    <path d="M21 4v5h-5" />
  </svg>
);

export const SparkIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
  </svg>
);

export const DownloadIcon: Icon = (props) => (
  <svg {...base(props)}>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 20h16" />
  </svg>
);
