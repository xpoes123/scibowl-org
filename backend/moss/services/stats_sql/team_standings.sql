-- Overall team standings for a tournament (no category filtering).
-- Params:
--   1) tournament_id

WITH game_team AS (
  SELECT
    g.id AS game_id,
    o.tournament_team_id AS tournament_team_id,
    SUM(o.points) AS points,
    SUM(CASE WHEN pq.question_type = 'TOSSUP' THEN 1 ELSE 0 END) AS tossups_heard,
    SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'CORRECT' THEN 1 ELSE 0 END) AS tossups_4,
    SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'INCORRECT' THEN 1 ELSE 0 END) AS tossups_neg,
    SUM(CASE WHEN pq.question_type = 'TOSSUP' AND o.tossup_result = 'NO_PENALTY' THEN 1 ELSE 0 END) AS tossups_0,
    SUM(CASE WHEN pq.question_type = 'BONUS' AND o.heard = 1 THEN 1 ELSE 0 END) AS bonuses_heard,
    SUM(CASE WHEN pq.question_type = 'BONUS' THEN o.points ELSE 0 END) AS bonus_points
  FROM moss_gameteamquestionoutcome o
  JOIN moss_game g ON g.id = o.game_id
  JOIN moss_packetquestion pq ON pq.id = o.packet_question_id
  WHERE g.tournament_id = %s
  GROUP BY g.id, o.tournament_team_id
),
with_opp AS (
  SELECT
    a.*,
    b.points AS opp_points
  FROM game_team a
  JOIN game_team b
    ON b.game_id = a.game_id
   AND b.tournament_team_id <> a.tournament_team_id
),
agg AS (
  SELECT
    tournament_team_id,
    COUNT(DISTINCT game_id) AS games_played,
    SUM(CASE WHEN points > opp_points THEN 1 ELSE 0 END) AS wins,
    SUM(CASE WHEN points < opp_points THEN 1 ELSE 0 END) AS losses,
    SUM(points) AS points,
    SUM(tossups_heard) AS tossups_heard,
    SUM(tossups_4) AS tossups_4,
    SUM(tossups_neg) AS tossups_neg,
    SUM(tossups_0) AS tossups_0,
    SUM(bonuses_heard) AS bonuses_heard,
    SUM(bonus_points) AS bonus_points
  FROM with_opp
  GROUP BY tournament_team_id
)
SELECT
  ROW_NUMBER() OVER (ORDER BY agg.wins DESC, agg.points DESC, tt.name ASC) AS rank,
  tt.id AS team_id,
  tt.name AS name,
  agg.wins AS wins,
  agg.losses AS losses,
  CAST(agg.points AS REAL) / NULLIF(agg.games_played, 0) AS points_per_game,
  agg.tossups_4 AS "4s",
  agg.tossups_neg AS "-4s",
  agg.tossups_0 AS "0s",
  agg.tossups_heard AS tossups_heard,
  agg.bonuses_heard AS bonuses_heard,
  agg.bonus_points AS bonus_points,
  CAST(agg.bonus_points AS REAL) / NULLIF(agg.bonuses_heard, 0) AS points_per_bonus
FROM agg
JOIN moss_tournamentteam tt ON tt.id = agg.tournament_team_id
ORDER BY rank;
