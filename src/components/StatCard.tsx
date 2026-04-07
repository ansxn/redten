'use client';

interface StatCardProps {
    value: string;
    label: string;
    color?: string;
}

export default function StatCard({ value, label, color }: StatCardProps) {
    return (
        <div className="stat-card">
            <div className="stat-value" style={color ? { color } : undefined}>
                {value}
            </div>
            <div className="stat-label">{label}</div>
        </div>
    );
}
