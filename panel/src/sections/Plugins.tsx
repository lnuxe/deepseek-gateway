import { useConsole } from '../lib/console';
import { Badge, Card, Dot } from '../components/ui/primitives';
import { SketchRule } from '../components/sketch/icons';

/** 请求管线上的内置处理环节 —— 只读展示，网关按固定顺序执行 */
const PIPELINE = [
  {
    id: 'auth',
    label: '密钥注入',
    en: 'key-inject',
    on: (s: ReturnType<typeof useConsole>['status']) => !!s?.key.present,
    desc: '客户端可以填任意占位 key，网关在转发前替换为本机保存的上游密钥，密钥不离开本机。',
  },
  {
    id: 'allow',
    label: '请求体白名单',
    en: 'body-whitelist',
    on: () => true,
    desc: '只透传已知字段（messages / stream / tools / temperature / max_tokens 等），客户端多发的字段会被剥离。',
  },
  {
    id: 'sse',
    label: '流式透传',
    en: 'sse-passthrough',
    on: () => true,
    desc: 'SSE 分块与 tool_calls 增量原样回传，不缓冲整段响应，首字节延迟与直连一致。',
  },
  {
    id: 'models',
    label: '模型清单',
    en: 'models-catalog',
    on: (s: ReturnType<typeof useConsole>['status']) => !!s?.upstream.ok,
    desc: '暴露上游真实模型列表，让客户端选择器能通过校验。',
  },
  {
    id: 'log',
    label: '请求日志',
    en: 'request-log',
    on: () => true,
    desc: '每次转发记录一行（模型、流式与否、状态码、耗时），写入 gateway.log，可在「日志」页实时查看。',
  },
  {
    id: 'health',
    label: '健康探测',
    en: 'health-probe',
    on: (s: ReturnType<typeof useConsole>['status']) => !!s?.upstream.ok,
    desc: '定期向上游拉取模型列表，用于控制台的状态指示与延迟数据。',
  },
];

export default function Plugins() {
  const { status } = useConsole();
  const custom = status?.localActionsLoaded;

  return (
    <div className="flex flex-col gap-3">
      <Card title="请求管线" subtitle="一个请求从进入网关到返回客户端，会依次经过这些环节">
        <ol className="relative flex flex-col">
          {PIPELINE.map((p, i) => {
            const on = p.on(status);
            return (
              <li key={p.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="relative flex w-5 shrink-0 justify-center">
                  <span className={`mt-[6px] h-[7px] w-[7px] rounded-full ${on ? 'bg-accent breathe text-accent' : 'bg-ink-4'}`} />
                  {i < PIPELINE.length - 1 && <span className="absolute top-4 bottom-0 w-px bg-hair" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[12.5px] text-ink">{p.label}</span>
                    <span className="font-mono text-[10.5px] text-ink-4">{p.en}</span>
                    <span className={`text-[11px] ${on ? 'text-ok' : 'text-ink-4'}`}>{on ? '启用中' : '未生效'}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{p.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <SketchRule className="opacity-70" />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="客户端补丁" subtitle="仅本机、不进仓库的适配脚本">
          <div className="flex items-center gap-2">
            <Dot tone={status?.cursor?.patched ? 'ok' : 'muted'} breathe={!!status?.cursor?.patched} />
            <span className="text-[12.5px] text-ink-2">
              {status?.cursor?.patched === undefined ? '未检测' : status.cursor?.patched ? '已应用' : '未应用'}
            </span>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-4">
            补丁用于让本机客户端走本地推理入口。它由独立的本地脚本管理（<span className="font-mono">local-actions.mjs</span>），
            只在检测到该文件时出现对应操作入口，位于「系统设置 → 客户端补丁」。
          </p>
        </Card>

        <Card title="扩展点" subtitle="当前版本内置的确定性行为">
          <ul className="flex flex-col gap-2 text-[11.5px] text-ink-3">
            <li className="flex items-center justify-between gap-3">
              <span>自定义动作脚本</span>
              <Badge tone={custom ? 'ok' : 'muted'}>{custom ? '已加载' : '未加载'}</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>请求体重写</span>
              <Badge tone="muted">固定白名单</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>限流 / 配额</span>
              <Badge tone="muted">未启用</Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span>缓存</span>
              <Badge tone="muted">透传，不缓存</Badge>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
