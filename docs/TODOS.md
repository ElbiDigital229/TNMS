# Todos

## Route

`/todos`

## Permission Required

`TODOS.ACCESS`

## Overview

Personal task management for each user. Todos are private to the user who created them.

## Todo Model

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| title | String | Todo text |
| status | Enum | OPEN or COMPLETED |
| dueDate | DateTime? | Optional due date |
| userId | UUID | Owner user |
| completedAt | DateTime? | When marked complete |
| createdAt | DateTime | Creation timestamp |

## Features

- Create todos with title and optional due date
- Mark as complete / reopen
- Delete todos
- Filter by status (all, open, completed)
- Stats: total count, completed count, open count

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/todos | List user's todos |
| GET | /api/todos/stats | Get todo counts |
| POST | /api/todos | Create todo |
| PATCH | /api/todos/:id/complete | Mark complete |
| PATCH | /api/todos/:id/reopen | Reopen |
| DELETE | /api/todos/:id | Delete todo |
