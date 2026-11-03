import { Box } from '@mui/material';
import productionChart from '../../assets/production-chart.svg';

export function ProductionChart() {
  return (
    <Box
      component="img"
      src={productionChart}
      className="auth-chart"
      alt=""
      aria-hidden="true"
    />
  );
}
