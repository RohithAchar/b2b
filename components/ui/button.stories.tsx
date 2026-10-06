import type { Meta, StoryObj } from "@storybook/nextjs"

import { Button } from "./button"

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Button",
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Outline: Story = {
  args: {
    variant: "outline",
  },
}

export const Secondary: Story = {
  args: {
    variant: "secondary",
  },
}

export const Destructive: Story = {
  args: {
    variant: "destructive",
  },
}

export const Small: Story = {
  args: {
    size: "sm",
  },
}

export const Large: Story = {
  args: {
    size: "lg",
  },
}
