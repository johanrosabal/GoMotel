'use client'

import { useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts"
import { formatCurrency } from "@/lib/utils"

export default function BillingTrendChart() {
  const data = useMemo(() => {
    return [
      { name: "Ene", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Feb", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Mar", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Abr", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "May", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Jun", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Jul", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Ago", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Sep", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Oct", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Nov", total: Math.floor(Math.random() * 500000) + 100000 },
      { name: "Dic", total: Math.floor(Math.random() * 500000) + 100000 },
    ]
  }, []);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey="name"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCurrency(value as number)}
        />
        <Tooltip
            contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
            }}
            cursor={{ fill: "hsl(var(--muted))" }}
            formatter={(value) => [formatCurrency(value as number), "Facturado"]}
        />
        <Bar
          dataKey="total"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
