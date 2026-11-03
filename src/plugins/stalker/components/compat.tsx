/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Small adapters so the plugin keeps working after Vencord removed
// `Forms`, the Discord `Text` component and `FormSwitchCompat`.

import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { Text as BaseText, type TextSize, type TextWeight } from "@components/Text";
import type { CSSProperties, ReactNode } from "react";

const SIZES = new Set(["xxs", "xs", "sm", "md", "lg", "xl", "xxl"]);
const WEIGHTS = new Set(["thin", "extralight", "light", "normal", "medium", "semibold", "bold", "extrabold"]);

interface TextProps {
    /** Old Discord style variant, e.g. "heading-lg/semibold" or "text-sm/normal" */
    variant?: string;
    /** Old Discord color token, e.g. "text-muted" */
    color?: string;
    style?: CSSProperties;
    className?: string;
    children?: ReactNode;
    onClick?(e: React.MouseEvent): void;
}

export function Text({ variant, color, style, children, ...rest }: TextProps) {
    let size: TextSize = "md";
    let weight: TextWeight = "normal";

    if (variant) {
        const [kind, w] = variant.split("/");
        const s = kind.split("-")[1];
        if (SIZES.has(s)) size = s as TextSize;
        if (w && WEIGHTS.has(w)) weight = w as TextWeight;
    }

    return (
        <BaseText
            size={size}
            weight={weight}
            style={color ? { color: `var(--${color})`, ...style } : style}
            {...rest}
        >
            {children}
        </BaseText>
    );
}

function FormText({ style, children, ...rest }: { style?: CSSProperties; className?: string; children?: ReactNode; }) {
    return <Paragraph style={style} {...rest}>{children}</Paragraph>;
}

function FormTitle({ tag = "h5", style, children, ...rest }: { tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6"; style?: CSSProperties; className?: string; children?: ReactNode; }) {
    return <Heading tag={tag} style={style} {...rest}>{children}</Heading>;
}

export const Forms = { FormText, FormTitle };

export function FormSwitchCompat({ value, onChange, note, children, disabled }: {
    value: boolean;
    onChange(value: boolean): void;
    note?: ReactNode;
    children?: ReactNode;
    disabled?: boolean;
}) {
    return (
        <FormSwitch
            title={children}
            description={note}
            value={value}
            onChange={onChange}
            disabled={disabled}
            hideBorder
        />
    );
}
