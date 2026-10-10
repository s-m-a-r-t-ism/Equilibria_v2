"""Data shared by the renderer and the timeline export."""
import score as S

BAR = S.BAR


def tb(bar, step16=0.0):
    return bar * BAR + step16 * S.E8 / 2


# (bar, start in eighths, length in eighths, midi): bridge first (Phrygian, between the words),
# then above the final chorus
THER_NOTES = [
    (74, 0, 6, 78), (74, 6, 2, 79), (75, 0, 8, 78), (76, 4, 4, 74), (77, 0, 8, 73),
    (78, 0, 6, 78), (78, 6, 2, 79), (79, 0, 4, 81), (79, 4, 4, 79),
    (80, 0, 16, 78), (82, 0, 8, 79), (83, 0, 8, 78),
    (88, 0, 8, 81), (89, 0, 8, 76), (90, 0, 8, 78), (91, 0, 8, 81), (92, 0, 6, 81), (92, 6, 2, 83),
    (93, 0, 8, 76), (94, 0, 8, 80), (95, 0, 8, 82), (96, 0, 16, 81), (98, 0, 16, 82),
    (100, 0, 16, 85), (102, 0, 24, 82),
]


# level of the radio static over time (seconds, gain)
RADIO_LEVEL = [(0, 0.32), (tb(4), 0.22), (tb(8), 0.07), (tb(24), 0.025), (tb(72), 0.03), (tb(78), 0.11),
               (tb(80), 0.16), (tb(84), 0.06), (tb(88), 0.02), (tb(100), 0.03), (tb(106), 0.12),
               (tb(111.5), 0.3), (tb(112), 0.0), (S.FINAL_ECHO_T - 1.5, 0.0), (S.FINAL_ECHO_T, 0.03),
               (S.FINAL_ECHO_T + 4, 0.03), (S.END_T, 0.0)]
