export type ServiceStatus = "running" | "exited" | "paused" | "dead" | string;

export type Service = {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
  status: ServiceStatus;
};
