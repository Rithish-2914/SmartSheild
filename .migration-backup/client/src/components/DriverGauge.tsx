import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

interface DriverGaugeProps {
  score: number;
}

export function DriverGauge({ score }: DriverGaugeProps) {
  // 100 is max score.
  // Data for the donut chart
  const data = [
    { name: "Score", value: score },
    { name: "Remaining", value: 100 - score },
  ];

  const getColor = (s: number) => {
    if (s > 80) return "hsl(var(--primary))";
    if (s > 50) return "hsl(24, 95%, 53%)"; // Orange-ish
    return "hsl(var(--destructive))";
  };

  const currentColor = getColor(score);

  return (
    <div className="relative h-64 w-full flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            startAngle={180}
            endAngle={0}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={currentColor} />
            <Cell fill="rgba(255,255,255,0.1)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center mt-10">
        <motion.div 
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          key={score}
          className="text-center"
        >
          <span className="block text-5xl font-display font-bold text-glow" style={{ color: currentColor }}>
            {score}
          </span>
          <span className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Safety Score</span>
        </motion.div>
      </div>

      {/* Decorative semi-circle background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[160px] h-[160px] rounded-full border border-dashed border-white/10" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
      </div>
    </div>
  );
}
