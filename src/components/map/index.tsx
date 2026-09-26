"use client";
import dynamic from "next/dynamic";

export const SaudiMap = dynamic(() => import("./saudi-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#08161b]" />,
});
