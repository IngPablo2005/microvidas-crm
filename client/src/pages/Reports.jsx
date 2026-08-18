import { useEffect, useState } from 'react';
import api from '../api/client.js';
import { Card, Loading, Button, fmtUSD } from '../components/UI.jsx';
import { CATEGORICAL, INK } from '../colors.js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FileDown } from 'lucide-react';

const BLUE = CATEGORICAL[0];

function ChartCard({ title, children, height = 260 }) {
  return (
    <Card className="p-4">
      <div className="text-sm font-semibold text-gray-700 mb-3">{title}</div>
      <div style={{ width: '100%', height }}>{children}</div>
    </Card>
  );
}

const axisStyle = { fontSize: 11, fill: INK.muted };
const tooltipStyle = { fontSize: 12, borderRadius: 8, border: `1px solid ${INK.grid}` };

export default function Reports() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const [weekly, monthly, yearly, pipeline, conversion, rankClients, rankProducts, colWeekly, colMonthly, colClient, colVendor, colMethod, debt] = await Promise.all([
        api.get('/reports/sales-weekly'), api.get('/reports/sales-monthly'), api.get('/reports/sales-yearly'),
        api.get('/reports/pipeline-evolution'), api.get('/reports/conversion'), api.get('/reports/ranking-clientes'),
        api.get('/reports/ranking-productos'), api.get('/reports/collections-weekly'), api.get('/reports/collections-monthly'),
        api.get('/reports/collections-by-client'), api.get('/reports/collections-by-vendor'), api.get('/reports/collections-by-method'),
        api.get('/reports/debt-evolution'),
      ]);
      setData({
        weekly: weekly.data, monthly: monthly.data, yearly: yearly.data, pipeline: pipeline.data, conversion: conversion.data,
        rankClients: rankClients.data, rankProducts: rankProducts.data, colWeekly: colWeekly.data, colMonthly: colMonthly.data,
        colClient: colClient.data, colVendor: colVendor.data, colMethod: colMethod.data, debt: debt.data,
      });
    })();
  }, []);

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Reportes comerciales</h1>
          <p className="text-sm text-gray-500">Evolución de ventas, pipeline, conversión y cobranzas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => window.open('/api/export/weekly-report?format=xlsx', '_blank')}>
            <FileDown size={14} className="inline mr-1" /> Reporte semanal (Excel)
          </Button>
          <Button onClick={() => window.open('/api/export/weekly-report?format=pdf', '_blank')}>
            <FileDown size={14} className="inline mr-1" /> Generar reporte semanal
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Ventas — últimos 7 días">
          <ResponsiveContainer><LineChart data={data.weekly}><CartesianGrid vertical={false} stroke={INK.grid} /><XAxis dataKey="fecha" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Line type="monotone" dataKey="importe" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Ventas por mes">
          <ResponsiveContainer><BarChart data={data.monthly}><CartesianGrid vertical={false} stroke={INK.grid} /><XAxis dataKey="mes" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="importe" fill={BLUE} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Ventas por año">
          <ResponsiveContainer><BarChart data={data.yearly}><CartesianGrid vertical={false} stroke={INK.grid} /><XAxis dataKey="anio" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="importe" fill={BLUE} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Evolución del pipeline por etapa">
          <ResponsiveContainer><BarChart data={data.pipeline}><CartesianGrid vertical={false} stroke={INK.grid} /><XAxis dataKey="etapa" tick={axisStyle} /><YAxis tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="valor" fill={CATEGORICAL[6]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Conversión comercial</div>
          <div className="grid grid-cols-2 gap-4 text-center py-4">
            <div>
              <div className="text-3xl font-bold" style={{ color: BLUE }}>{data.conversion.prospectos_a_clientes}%</div>
              <div className="text-xs text-gray-500 mt-1">Prospectos → Clientes</div>
              <div className="text-xs text-gray-400">{data.conversion.detalle.ganados} de {data.conversion.detalle.totalProspectos}</div>
            </div>
            <div>
              <div className="text-3xl font-bold" style={{ color: CATEGORICAL[2] }}>{data.conversion.cotizaciones_a_ventas}%</div>
              <div className="text-xs text-gray-500 mt-1">Cotizaciones → Ventas</div>
              <div className="text-xs text-gray-400">{data.conversion.detalle.aceptadas} de {data.conversion.detalle.totalCotizaciones}</div>
            </div>
          </div>
        </Card>
        <ChartCard title="Vencido vs. cobrado vs. pendiente">
          <ResponsiveContainer><BarChart data={[{ name: 'Cartera', vencido: data.debt.vencido, cobrado: data.debt.cobrado, pendiente: data.debt.pendiente }]} layout="vertical">
            <CartesianGrid horizontal={false} stroke={INK.grid} /><XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="name" tick={axisStyle} width={70} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} />
            <Bar dataKey="cobrado" fill={CATEGORICAL[2]} radius={[4, 4, 4, 4]} name="Cobrado" />
          </BarChart></ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-xs text-gray-500 justify-center">
            <span>Vencido: {fmtUSD(data.debt.vencido)}</span><span>Cobrado: {fmtUSD(data.debt.cobrado)}</span><span>Pendiente: {fmtUSD(data.debt.pendiente)}</span>
          </div>
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ChartCard title="Ranking de clientes (por facturación)" height={300}>
          <ResponsiveContainer><BarChart data={data.rankClients} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} stroke={INK.grid} /><XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="razon_social" tick={{ ...axisStyle, fontSize: 10 }} width={140} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="total" fill={BLUE} radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Ranking de productos (por volumen de ventas)" height={300}>
          <ResponsiveContainer><BarChart data={data.rankProducts} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} stroke={INK.grid} /><XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="descripcion" tick={{ ...axisStyle, fontSize: 10 }} width={140} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="total" fill={CATEGORICAL[1]} radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <ChartCard title="Cobranzas — últimos 30 días">
          <ResponsiveContainer><LineChart data={data.colWeekly}><CartesianGrid vertical={false} stroke={INK.grid} /><XAxis dataKey="fecha" tick={{ ...axisStyle, fontSize: 9 }} /><YAxis tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Line type="monotone" dataKey="importe" stroke={CATEGORICAL[2]} strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cobranzas por cliente">
          <ResponsiveContainer><BarChart data={data.colClient} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid horizontal={false} stroke={INK.grid} /><XAxis type="number" tick={axisStyle} /><YAxis type="category" dataKey="razon_social" tick={{ ...axisStyle, fontSize: 9 }} width={110} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="total" fill={CATEGORICAL[2]} radius={[0, 4, 4, 0]} />
          </BarChart></ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cobranzas por medio de pago">
          <ResponsiveContainer><BarChart data={data.colMethod}><CartesianGrid vertical={false} stroke={INK.grid} /><XAxis dataKey="medio_pago" tick={{ ...axisStyle, fontSize: 9 }} /><YAxis tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} formatter={v => fmtUSD(v)} /><Bar dataKey="total" fill={CATEGORICAL[3]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
