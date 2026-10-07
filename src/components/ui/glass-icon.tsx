"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { LiquidButton } from "./liquid-glass-button"

/**
 * A round icon button in liquid glass: the bottom bar's buttons and the round buttons in the phone
 * headers. `size` is the diameter in pixels (36 by default); `on` marks the screen you're on.
 */
export function GlassIcon({
  className,
  size = 36,
  on = false,
  style,
  ...props
}: React.ComponentProps<"button"> & { size?: number; on?: boolean }) {
  return (
    <LiquidButton
      size="icon"
      className={cn("glass-icon rounded-full p-0", on && "is-on", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    />
  )
}
