"use client";

import { useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
// @ts-ignore
import DottedMap from "dotted-map";
import Image from "next/image";
import { useTheme } from "next-themes";

interface MapProps {
  dots?: Array<{
    start: { lat: number; lng: number; label?: string };
    end: { lat: number; lng: number; label?: string };
    color?: string; // custom line color for this path
  }>;
  lineColor?: string;
  showLabels?: boolean;
  labelClassName?: string;
  animationDuration?: number;
  loop?: boolean;
}

export function WorldMap({ 
  dots = [], 
  lineColor = "#0ea5e9",
  showLabels = true,
  animationDuration = 2.5,
  loop = true
}: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const { theme } = useTheme();

  // Create the dotted map background
  const map = useMemo(
    () => new DottedMap({ height: 100, grid: "diagonal" }),
    []
  );

  const svgMap = useMemo(
    () => map.getSVG({
      radius: 0.22,
      color: "rgba(255, 255, 255, 0.08)",
      shape: "circle",
      backgroundColor: "black",
    }),
    [map]
  );

  // Projection helper to convert Lat/Lng coordinates into SVG viewBox coordinate space
  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 50; // Curve arc upwards
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  const staggerDelay = 0.3;
  const totalAnimationTime = dots.length * staggerDelay + animationDuration;
  const pauseTime = 1.5;
  const fullCycleDuration = totalAnimationTime + pauseTime;

  return (
    <div className="w-full aspect-[2/1] md:aspect-[2.3/1] bg-[#060A13] border border-white/[0.04] rounded-2xl relative font-sans overflow-hidden shadow-[inset_0_0_40px_rgba(0,0,0,0.85)]">
      {/* Render the dotted map SVG background */}
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_12%,white_88%,transparent)] pointer-events-none select-none object-cover opacity-60"
        alt="world map background"
        height="495"
        width="1056"
        draggable={false}
        priority
      />

      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="w-full h-full absolute inset-0 pointer-events-auto select-none z-10"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="glow-path">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* FLOW LINES */}
        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          
          const startTime = (i * staggerDelay) / fullCycleDuration;
          const endTime = (i * staggerDelay + animationDuration) / fullCycleDuration;
          const resetTime = totalAnimationTime / fullCycleDuration;
          const pathColor = dot.color || lineColor;
          const dPath = createCurvedPath(startPoint, endPoint);
          
          return (
            <g key={`path-group-${i}`}>
              <defs>
                <linearGradient id={`map-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="25%" stopColor={pathColor} stopOpacity="0.8" />
                  <stop offset="75%" stopColor={pathColor} stopOpacity="0.8" />
                  <stop offset="100%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* Curved flow connection line */}
              <motion.path
                d={dPath}
                fill="none"
                stroke={`url(#map-grad-${i})`}
                strokeWidth="1.75"
                initial={{ pathLength: 0 }}
                animate={loop ? {
                  pathLength: [0, 0, 1, 1, 0],
                } : {
                  pathLength: 1
                }}
                transition={loop ? {
                  duration: fullCycleDuration,
                  times: [0, startTime, endTime, resetTime, 1],
                  ease: "easeInOut",
                  repeat: Infinity,
                  repeatDelay: 0,
                } : {
                  duration: animationDuration,
                  delay: i * staggerDelay,
                  ease: "easeInOut",
                }}
                style={{ filter: "url(#glow-path)", opacity: 0.8 }}
              />
              
              {/* Animated particle running along the connection line */}
              {loop && (
                <motion.circle
                  r="4"
                  fill={pathColor}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{
                    offsetDistance: [null, "0%", "100%", "100%", "100%"],
                    opacity: [0, 0, 1, 0, 0],
                  }}
                  transition={{
                    duration: fullCycleDuration,
                    times: [0, startTime, endTime, resetTime, 1],
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 0,
                  }}
                  style={{
                    offsetPath: `path('${dPath}')`,
                    filter: `drop-shadow(0 0 6px ${pathColor})`
                  }}
                />
              )}
            </g>
          );
        })}

        {/* NODES (Dots over map) */}
        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          const pathColor = dot.color || lineColor;
          
          return (
            <g key={`points-group-${i}`}>
              {/* Start Node */}
              <g key={`start-${i}`}>
                <motion.g
                  onHoverStart={() => setHoveredLocation(dot.start.label || `Location ${i}`)}
                  onHoverEnd={() => setHoveredLocation(null)}
                  className="cursor-pointer"
                  whileHover={{ scale: 1.3 }}
                  transition={{ type: "spring", stiffness: 450, damping: 10 }}
                >
                  <circle
                    cx={startPoint.x}
                    cy={startPoint.y}
                    r="4"
                    fill={pathColor}
                    filter="url(#glow-path)"
                  />
                  <circle
                    cx={startPoint.x}
                    cy={startPoint.y}
                    r="4"
                    fill={pathColor}
                    opacity="0.4"
                  >
                    <animate
                      attributeName="r"
                      from="4"
                      to="14"
                      dur="2.5s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.5"
                      to="0"
                      dur="2.5s"
                      begin="0s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </motion.g>
                
                {showLabels && dot.start.label && (
                  <motion.g
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 * i + 0.3, duration: 0.4 }}
                    className="pointer-events-none"
                  >
                    <foreignObject
                      x={startPoint.x - 40}
                      y={startPoint.y - 28}
                      width="80"
                      height="20"
                    >
                      <div className="flex items-center justify-center h-full">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/90 text-slate-300 border border-white/[0.08] shadow-md uppercase tracking-wider select-none leading-none">
                          {dot.start.label}
                        </span>
                      </div>
                    </foreignObject>
                  </motion.g>
                )}
              </g>
              
              {/* End Node */}
              <g key={`end-${i}`}>
                <motion.g
                  onHoverStart={() => setHoveredLocation(dot.end.label || `Destination ${i}`)}
                  onHoverEnd={() => setHoveredLocation(null)}
                  className="cursor-pointer"
                  whileHover={{ scale: 1.3 }}
                  transition={{ type: "spring", stiffness: 450, damping: 10 }}
                >
                  <circle
                    cx={endPoint.x}
                    cy={endPoint.y}
                    r="4"
                    fill={pathColor}
                    filter="url(#glow-path)"
                  />
                  <circle
                    cx={endPoint.x}
                    cy={endPoint.y}
                    r="4"
                    fill={pathColor}
                    opacity="0.4"
                  >
                    <animate
                      attributeName="r"
                      from="4"
                      to="14"
                      dur="2.5s"
                      begin="0.8s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.5"
                      to="0"
                      dur="2.5s"
                      begin="0.8s"
                      repeatCount="indefinite"
                    />
                  </circle>
                </motion.g>
                
                {showLabels && dot.end.label && (
                  <motion.g
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 * i + 0.5, duration: 0.4 }}
                    className="pointer-events-none"
                  >
                    <foreignObject
                      x={endPoint.x - 40}
                      y={endPoint.y - 28}
                      width="80"
                      height="20"
                    >
                      <div className="flex items-center justify-center h-full">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/90 text-slate-300 border border-white/[0.08] shadow-md uppercase tracking-wider select-none leading-none">
                          {dot.end.label}
                        </span>
                      </div>
                    </foreignObject>
                  </motion.g>
                )}
              </g>
            </g>
          );
        })}
      </svg>

      {/* Floating status */}
      <div className="absolute bottom-3 left-3 bg-[#0A0F1D]/85 border border-white/[0.06] rounded-xl px-3 py-1.5 backdrop-blur-md z-20 text-[9px] font-mono text-slate-400 flex items-center gap-2 select-none shadow-md">
        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-ping" />
        Scoping capital arcs in real-time
      </div>
    </div>
  );
}
