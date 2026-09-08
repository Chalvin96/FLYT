from typing import Literal


type UserLemmaState = Literal["new", "learning", "mastered"]

K_USER_LEMMA_STATE_NEW: UserLemmaState = "new"
K_USER_LEMMA_STATE_LEARNING: UserLemmaState = "learning"
K_USER_LEMMA_STATE_MASTERED: UserLemmaState = "mastered"
