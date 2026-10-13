import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";

export function Slider(props: ComponentProps<typeof SliderPrimitive.Root>) {
    return (
        <SliderPrimitive.Root className="slider" {...props}>
            <SliderPrimitive.Track className="slider-track">
                <SliderPrimitive.Range className="slider-range" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="slider-thumb" aria-label={props["aria-label"]} />
        </SliderPrimitive.Root>
    );
}
