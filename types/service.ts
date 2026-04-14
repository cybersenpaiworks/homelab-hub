export type ServiceStatus = "running" | "exited" | "paused" | "dead" | string;
export type ServiceUrlSource = "manual" | "label" | "derived" | "none";

export type Service = {
  id: string;
  containerId: string | null;
  name: string;
  url: string;
  autoUrl: string;
  urlSource: ServiceUrlSource;
  icon: string;
  description: string;
  status: ServiceStatus;
  isAvailable: boolean;
};
