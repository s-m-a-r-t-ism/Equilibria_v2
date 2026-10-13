"""espeak-ng wrapper: speech audio plus phoneme timings (used as the formant
source for the sung voice and as the numbers-station voice)."""
import ctypes, numpy as np
import espeakng_loader as E

class _EvId(ctypes.Union):
    _fields_ = [("number", ctypes.c_int), ("name", ctypes.c_char_p), ("string", ctypes.c_char * 8)]

class _Ev(ctypes.Structure):
    _fields_ = [("type", ctypes.c_int), ("unique_identifier", ctypes.c_uint), ("text_position", ctypes.c_int),
                ("length", ctypes.c_int), ("audio_position", ctypes.c_int), ("sample", ctypes.c_int),
                ("user_data", ctypes.c_void_p), ("id", _EvId)]

_lib = ctypes.CDLL(E.get_library_path())
_CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.POINTER(_Ev))
_buf, _events = [], []

def _cb(wav, n, ev):
    if wav and n > 0:
        _buf.extend(wav[:n])
    i = 0
    while ev and ev[i].type != 0:
        e = ev[i]
        if e.type == 7:  # phoneme
            _events.append(("ph", bytes(e.id.string).split(b"\0")[0].decode(), e.sample, e.audio_position))
        elif e.type == 1:  # word
            _events.append(("word", e.text_position, e.sample))
        i += 1
    return 0

_cbp = _CB(_cb)
SR = _lib.espeak_Initialize(2, 0, E.get_data_path().encode(), 1)  # synchronous, phoneme events
_lib.espeak_SetSynthCallback(_cbp)

VOWEL_START = set("aAeEiIoOuUV03@")

def say(text, voice="en", rate=140, pitch=50, prange=40):
    """Return (float32 audio at SR, list of (phoneme, sample_index))."""
    _buf.clear(); _events.clear()
    _lib.espeak_SetVoiceByName(voice.encode())
    _lib.espeak_SetParameter(1, rate, 0)
    _lib.espeak_SetParameter(3, pitch, 0)
    _lib.espeak_SetParameter(4, prange, 0)
    _lib.espeak_SetParameter(7, 0, 0)  # word gap
    t = text.encode()
    _lib.espeak_Synth(t, len(t) + 1, 0, 0, 0, 0x100, None, None)  # espeakPHONEMES: allow [[...]]
    _lib.espeak_Synchronize()
    a = np.array(_buf, dtype=np.float32) / 32768.0
    ph = [(e[1], e[2]) for e in _events if e[0] == "ph" and e[1]]
    words = [e[2] for e in _events if e[0] == "word"]
    return a, ph, words

def bare(p):
    return p.lstrip("',%=")

def is_vowel(p):
    b = bare(p)
    return bool(b) and b[0] in VOWEL_START

def vowels(ph):
    return [(p, s) for p, s in ph if is_vowel(p)]

if __name__ == "__main__":
    import sys
    a, ph, w = say(sys.argv[1] if len(sys.argv) > 1 else "I put a wire up through the frost and sang it to the black")
    print(SR, len(a) / SR)
    print(ph); print(w)
    print(len(vowels(ph)), vowels(ph))
