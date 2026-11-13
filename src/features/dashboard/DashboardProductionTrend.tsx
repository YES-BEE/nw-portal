import { Paper, Typography, useMediaQuery } from '@mui/material';
import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { LineChart, type LineSeriesOption } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  type GridComponentOption,
  type LegendComponentOption,
  type TooltipComponentOption,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

// Use the ESM React wrapper and register only the chart features we render.
echarts.use([
  LineChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  SVGRenderer,
]);
type TrendOption = echarts.ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | TooltipComponentOption
>;
import { useTranslation } from 'react-i18next';
import type { ProductionTrend } from './types';

export function DashboardProductionTrend({
  trend,
}: {
  trend: ProductionTrend;
}) {
  const { t } = useTranslation('translation');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: trend.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const option: TrendOption = {
    animation: !reduceMotion,
    animationDuration: 650,
    animationDurationUpdate: 650,
    textStyle: {
      fontFamily: '"Inter Variable", Arial, Helvetica, sans-serif',
      fontSize: 11,
    },
    aria: { enabled: true, description: t('dashboard.productionTrend') },
    color: ['#16a365', '#0957f7'],
    grid: {
      top: 50,
      right: 16,
      bottom: 28,
      left: 48,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    legend: { top: 12, textStyle: { fontSize: 11 } },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      textStyle: { fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trend.points.map((point) =>
        time.format(new Date(point.bucket_start)),
      ),
      axisLabel: { fontSize: 11, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef2f7' } },
    },
    series: [
      {
        id: 'completed',
        name: t('dashboard.trendCompleted'),
        type: 'line',
        data: trend.points.map((point) => point.completed),
        smooth: false,
        showSymbol: true,
        symbolSize: 6,
      },
      {
        id: 'in_progress',
        name: t('dashboard.trendInProgress'),
        type: 'line',
        data: trend.points.map((point) => point.in_progress),
        smooth: false,
        showSymbol: true,
        symbolSize: 6,
      },
    ],
  };
  return (
    <Paper
      component="section"
      aria-labelledby="production-trend-title"
      variant="outlined"
      sx={{ borderRadius: 2, borderColor: '#e7edf5', minWidth: 0, p: 2 }}
    >
      <Typography
        component="h2"
        id="production-trend-title"
        sx={{ fontSize: 15, fontWeight: 700 }}
      >
        {t('dashboard.productionTrend')}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 11 }}>
        {t('dashboard.trendHint', { timezone: trend.timezone })}
      </Typography>
      <ReactEChartsCore
        echarts={echarts}
        option={option}
        opts={{ renderer: 'svg' }}
        style={{ height: 290, width: '100%' }}
        autoResize
        notMerge
      />
    </Paper>
  );
}
