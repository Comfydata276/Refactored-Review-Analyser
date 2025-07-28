import type { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface AnalyzedReview {
  id: number
  app_name: string
  app_id: number
  review_id: string
  author: string
  review_text: string
  voted_up: boolean
  votes_up: number
  votes_funny: number
  weighted_vote_score: number
  playtime_forever: number
  timestamp_created: number
  sentiment: string
  topics: string[]
  summary: string
  rating: number
}

export const columns: ColumnDef<AnalyzedReview>[] = [
  {
    accessorKey: "app_name",
    header: "Game",
    cell: ({ row }) => (
      <div className="font-medium max-w-[150px] truncate">
        {row.getValue("app_name")}
      </div>
    ),
  },
  {
    accessorKey: "author",
    header: "Author",
    cell: ({ row }) => (
      <div className="max-w-[120px] truncate">
        {row.getValue("author")}
      </div>
    ),
  },
  {
    accessorKey: "sentiment",
    header: "Sentiment",
    cell: ({ row }) => {
      const sentiment = row.getValue("sentiment") as string
      const variant = 
        sentiment === "positive" ? "default" :
        sentiment === "negative" ? "destructive" :
        "secondary"
      
      return (
        <Badge variant={variant} className="capitalize">
          {sentiment}
        </Badge>
      )
    },
  },
  {
    accessorKey: "rating",
    header: "Rating",
    cell: ({ row }) => {
      const rating = row.getValue("rating") as number
      return (
        <div className="flex items-center">
          <span className="font-medium">{rating}/10</span>
        </div>
      )
    },
  },
  {
    accessorKey: "voted_up",
    header: "Recommended",
    cell: ({ row }) => {
      const votedUp = row.getValue("voted_up") as boolean
      return (
        <Badge variant={votedUp ? "default" : "destructive"}>
          {votedUp ? "Yes" : "No"}
        </Badge>
      )
    },
  },
  {
    accessorKey: "playtime_forever",
    header: "Playtime",
    cell: ({ row }) => {
      const playtime = row.getValue("playtime_forever") as number
      const hours = Math.floor(playtime / 60)
      return (
        <div className="text-sm">
          {hours}h
        </div>
      )
    },
  },
  {
    accessorKey: "summary",
    header: "Summary",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate text-sm text-muted-foreground">
        {row.getValue("summary")}
      </div>
    ),
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const review = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(review.review_id)}
            >
              Copy review ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <ExternalLink className="mr-2 h-4 w-4" />
              View details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]