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

export default function StockDistributionChart({ services }: { services: any[] }) {
    const chartData = React.useMemo(() => {
        const dataByCategory = services.reduce((acc, service) => {
            const catName = service.categoryName || 'Sin Categoría';
            if (!acc[catName]) {
                acc[catName] = 0;
            }
            acc[catName] += service.stock;
            return acc;
        }, {} as Record<string, number>);

        const COLORS_ARRAY = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

        return Object.entries(dataByCategory).map(([category, stock], index) => ({
            name: category,
            value: stock,
            fill: COLORS_ARRAY[index % COLORS_ARRAY.length],
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
