import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '../lib/chartTheme';

/**
 * 1日の歩数を1時間ごとに見る棒グラフ。
 * 「ふりかえり」タブと「カレンダー」の歩数シートで同じものを使う。
 *
 * Rechartsはバンドルの大部分を占めるため、常に読み込まれる画面から
 * 直接importしないこと(カレンダー側はlazyで読み込んでいる)。
 */
export function HourlyStepsChart({ hourly, height = 260 }: { hourly: number[]; height?: number }) {
  const theme = useChartTheme();
  const data = hourly.map((v, h) => ({ h: `${h}`, steps: v }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={theme.grid} vertical={false} />
        <XAxis
          dataKey="h"
          tick={{ fontSize: 10, fill: theme.axis }}
          stroke={theme.grid}
          interval={2}
        />
        <YAxis tick={{ fontSize: 10, fill: theme.axis }} stroke="transparent" width={60} />
        <Tooltip
          contentStyle={{
            background: theme.surface,
            border: `1px solid ${theme.grid}`,
            borderRadius: 8,
            fontSize: 12,
          }}
          cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
          formatter={(v: unknown) => `${typeof v === 'number' ? v.toLocaleString() : ''}歩`}
          labelFormatter={(h) => `${h}時台`}
        />
        <Bar dataKey="steps" name="歩数" fill={theme.steps} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
