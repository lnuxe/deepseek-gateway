import {
  IconCert,
  IconConsumers,
  IconLogs,
  IconMetrics,
  IconOverview,
  IconPlugins,
  IconRoutes,
  IconSettings,
  IconUpstream,
} from '../components/sketch/icons';

export const NAV = [
  { id: 'overview', label: '概览', en: 'Overview', desc: '网关整体运行概况', icon: IconOverview },
  { id: 'routes', label: '网关路由', en: 'Routes', desc: '本机对外提供的接口与转发目标', icon: IconRoutes },
  { id: 'upstreams', label: '上游服务', en: 'Upstreams', desc: 'DeepSeek 上游连通性与模型清单', icon: IconUpstream },
  { id: 'consumers', label: '消费者', en: 'Consumers', desc: '谁在调用这个网关', icon: IconConsumers },
  { id: 'plugins', label: '插件', en: 'Plugins', desc: '请求管线上的内置处理环节', icon: IconPlugins },
  { id: 'certificates', label: '证书', en: 'Certificates', desc: '上游 TLS 证书与有效期', icon: IconCert },
  { id: 'logs', label: '日志', en: 'Logs', desc: '请求日志实时查看', icon: IconLogs },
  { id: 'metrics', label: '监控', en: 'Metrics', desc: '吞吐、延迟与错误率', icon: IconMetrics },
  { id: 'settings', label: '系统设置', en: 'Settings', desc: '监听、自启与运行时信息', icon: IconSettings },
] as const;

export type SectionId = (typeof NAV)[number]['id'];

export const findNav = (id: string) => NAV.find((n) => n.id === id) ?? NAV[0];
