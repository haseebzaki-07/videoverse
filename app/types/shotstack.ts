export interface ShotstackEffect {
  type: string;
  options?: {
    [key: string]: any;
  };
}

export interface ShotstackClip {
  src: string;
  startTime: number;
  duration: number;
  effects?: ShotstackEffect[];
}

export interface ShotstackOutput {
  format: "mp4" | "gif" | "mov";
  resolution: "480p" | "720p" | "1080p";
}

export interface ShotstackEditRequest {
  clips: ShotstackClip[];
  audioSrc?: string;
  output: ShotstackOutput;
}

export interface ShotstackResponse {
  status: "success" | "error";
  message: string;
  url?: string;
  error?: string;
}
