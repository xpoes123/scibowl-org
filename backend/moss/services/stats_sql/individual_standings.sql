-- Overall individual standings for a tournament (no category filtering).
-- Params:
--   1) tournament_id
--   2) tournament_id

WITH tuh_by_game AS (
  SELECT
    s.game_id AS game_id,
    s.tournament_player_id AS tournament_player_id,
    s.tournament_team_id AS tournament_team_id,
    SUM(
      CASE
        WHEN COALESCE(s.end_pair_id, g.pairs_played) >= s.start_pair_id
          THEN (COALESCE(s.end_pair_id, g.pairs_played) - s.start_pair_id + 1)
        ELSE 0
      END
    ) AS tossups_heard
  FROM moss_gameplayerlineupsegment s
  JOIN moss_game g ON g.id = s.game_id
  WHERE g.tournament_id = %s
  GROUP BY s.game_id, s.tournament_player_id, s.tournament_team_id
),
buzz_by_game AS (
  SELECT
    o.game_id AS game_id,
    o.buzzing_player_id AS tournament_player_id,
    o.tournament_team_id AS tournament_team_id,
    SUM(CASE WHEN o.tossup_result = 'CORRECT' THEN 1 ELSE 0 END) AS tossups_4,
    SUM(CASE WHEN o.tossup_result = 'INCORRECT' THEN 1 ELSE 0 END) AS tossups_neg,
    SUM(o.points) AS tossup_points
  FROM moss_gameteamquestionoutcome o
  JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
  JOIN moss_game g ON g.id = o.game_id
  WHERE g.tournament_id = %s
    AND pq.question_type = 'TOSSUP'
    AND o.buzzing_player_id IS NOT NULL
  GROUP BY o.game_id, o.buzzing_player_id, o.tournament_team_id
),
player_game_rows AS (
  SELECT
    t.game_id AS game_id,
    t.tournament_player_id AS tournament_player_id,
    t.tournament_team_id AS tournament_team_id,
    t.tossups_heard AS tossups_heard,
    COALESCE(b.tossups_4, 0) AS tossups_4,
    COALESCE(b.tossups_neg, 0) AS tossups_neg,
    COALESCE(b.tossup_points, 0) AS tossup_points
  FROM tuh_by_game t
  LEFT JOIN buzz_by_game b
    ON b.game_id = t.game_id
   AND b.tournament_player_id = t.tournament_player_id
   AND b.tournament_team_id = t.tournament_team_id

  UNION ALL

  SELECT
    b.game_id AS game_id,
    b.tournament_player_id AS tournament_player_id,
    b.tournament_team_id AS tournament_team_id,
    0 AS tossups_heard,
    b.tossups_4 AS tossups_4,
    b.tossups_neg AS tossups_neg,
    b.tossup_points AS tossup_points
  FROM buzz_by_game b
  LEFT JOIN tuh_by_game t
    ON t.game_id = b.game_id
   AND t.tournament_player_id = b.tournament_player_id
   AND t.tournament_team_id = b.tournament_team_id
  WHERE t.tournament_player_id IS NULL
),
agg AS (
  SELECT
    tournament_player_id,
    tournament_team_id,
    COUNT(DISTINCT game_id) AS games_played,
    SUM(tossups_heard) AS tossups_heard,
    SUM(tossups_4) AS tossups_4,
    SUM(tossups_neg) AS tossups_neg,
    SUM(tossup_points) AS tossup_points
  FROM player_game_rows
  GROUP BY tournament_player_id, tournament_team_id
),
filtered AS (
  SELECT *
  FROM agg
  WHERE tossups_heard > 0 OR tossups_4 > 0 OR tossups_neg > 0
)
SELECT
  ROW_NUMBER() OVER (ORDER BY filtered.tossup_points DESC, filtered.tossups_4 DESC, tp.name ASC) AS rank,
  tp.id AS player_id,
  tp.name AS name,
  tt.name AS team,
  filtered.games_played AS games_played,
  filtered.tossups_4 AS "4s",
  filtered.tossups_neg AS "-4s",
  CASE
    WHEN (filtered.tossups_heard - filtered.tossups_4 - filtered.tossups_neg) > 0
      THEN (filtered.tossups_heard - filtered.tossups_4 - filtered.tossups_neg)
    ELSE 0
  END AS "0s",
  filtered.tossups_heard AS tossups_heard,
  filtered.tossup_points AS tossup_points,
  CAST(filtered.tossup_points AS REAL) / NULLIF(filtered.games_played, 0) AS points_per_game
FROM filtered
JOIN moss_tournamentplayer tp ON tp.id = filtered.tournament_player_id
JOIN moss_tournamentteam tt ON tt.id = filtered.tournament_team_id
ORDER BY rank;
