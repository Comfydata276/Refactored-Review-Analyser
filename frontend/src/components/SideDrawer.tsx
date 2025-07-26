// src/components/SideDrawer.tsx
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Drawer, List, ListItemButton, ListItemIcon, ListItemText, Toolbar } from '@mui/material'
import HomeIcon from '@mui/icons-material/Home'
import SettingsIcon from '@mui/icons-material/Settings'
import SearchIcon from '@mui/icons-material/Search'
import EditIcon from '@mui/icons-material/Edit'
import HelpIcon from '@mui/icons-material/Help'
import { Link } from 'react-router-dom'

const drawerWidth = 240

const items = [
  { text: 'Home', icon: <HomeIcon />, path: '/' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  { text: 'Finder', icon: <SearchIcon />, path: '/finder' },
  { text: 'Prompt', icon: <EditIcon />, path: '/prompt' },
  { text: 'Help', icon: <HelpIcon />, path: '/help' },
]

export default function SideDrawer({ children }: { children: ReactNode }) {
  const [open] = useState(true)
  return (
    <div style={{ display:'flex' }}>
      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: drawerWidth,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List>
          {items.map((it) => (
            <ListItemButton component={Link} to={it.path} key={it.text}>
              <ListItemIcon>{it.icon}</ListItemIcon>
              <ListItemText primary={it.text} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>
      <main style={{ flexGrow:1, padding: '24px' }}>
        <Toolbar />
        {children}
      </main>
    </div>
  )
}