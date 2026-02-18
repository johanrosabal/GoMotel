'use client'

import * as React from "react"
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from "recharts"
import type { Service } from "@/types"

const COLORS = {
    Beverage: "hsl(var(--chart-1))",
    Food: "hsl(var(--chart-2))",
    Amenity: "hsl(var(--chart-3))",
}

type ChartData = {
  name: string;
  value: number;
  fill: string;
}

const categoryMap: Record<Service['category'], string> = {
    Beverage: "Bebidas",
    Food: "Comidas",
    Amenity: "Amenidades",
}

export default function StockDistributionChart({ services }: { services: Service[] }) {
    const chartData = React.useMemo(() => {
        const dataByCategory = services.reduce((acc, service) => {
            if (!acc[service.category]) {
                acc[service.category] = 0;
            }
            acc[service.category] += service.stock;
            return acc;
        }, {} as Record<Service['category'], number>);

        return Object.entries(dataByCategory).map(([category, stock]) => ({
            name: categoryMap[category as Service['category']],
            value: stock,
            fill: COLORS[category as Service['category']],
        })) as ChartData[];
    }, [services]);

  return (
    <div style={{width: '100%', height: 350}}>
        <ResponsiveContainer>
            <PieChart>
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                    }}
                    formatter={(value, name) => [value, name]}
                />
                <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                innerRadius={70}
                paddingAngle={5}
                dataKey="value"
                >
                {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke={"hsl(var(--background))"} strokeWidth={2} />
                ))}
                </Pie>
                 <Legend
                    iconSize={10}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    formatter={(value) => <span className="text-muted-foreground">{value}</span>}
                />
            </PieChart>
        </ResponsiveContainer>
    </div>
  )
}
