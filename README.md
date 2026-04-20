# Mahjong Omakase 🀄

A mahjong score tracker for friends.

## Features

### Game Modes
Three mahjong variants with auto-calculated scoring:
- **国标麻将** — Standard 8-point base scoring
- **东北麻将 (抗日麻将)** — 番-based scoring with 庄家 and 闭门 multipliers
- **立直麻将** — 番/符 point lookup with 本场, 供托, and 流局 (听牌/未听) support

### Home
Landing page with quick access to start a game

### Game Session
- Select game mode and players to start a new session
- Round-by-round score entry with auto-calculated payments
- Live score board with running totals and real-time rankings
- Support for 自摸 and 点炮

### Stats & Leaderboard
- Quarterly seasons: 春之赛季, 夏之赛季, 秋之赛季, 冬之赛季
- 🏆 赛季冠军 and 👑 最多胜场 highlights
- Filter leaderboard by game mode
- Player profiles with individual game history

### Player Registration
- Sign up with username, first name, last name
- Full Chinese UI, mobile responsive

## Tech Stack

- Spring Boot 3 + Java 17 + H2 Database
- React 18 + TypeScript + Vite
- Gradle with node-gradle plugin for unified builds

## Run

```bash
./gradlew bootRun
```

Then open http://localhost:8080.

## Build

```bash
./gradlew build
```

Produces a single deployable JAR at `build/libs/mahjong-omakase-*.jar` with both backend and frontend bundled.

## Acknowledgment

This project draws inspiration and logic concepts from [XDean/tool.xdean.cn](https://github.com/XDean/tool.xdean.cn). We would like to clarify that while we referred to XDean's engine logic for validation and benchmark purposes, all codebase and scoring logic in **Mahjong Omakase** have been completely rewritten from scratch in TypeScript to follow our own design system and architectural principles.

## License

[GPL-3.0](LICENSE)
