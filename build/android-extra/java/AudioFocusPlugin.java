package com.h24creationz.tunetune;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the app about phone calls, alarms, navigation prompts and notification sounds (Android "audio focus"),
 * like Spotify: calls pause and resume afterwards, notifications lower songs for a moment, podcasts pause briefly.
 * The app decides what to do with each event (Settings → Pause for calls & notifications).
 */
@CapacitorPlugin(name = "AudioFocus")
public class AudioFocusPlugin extends Plugin {
    private AudioManager am;
    private AudioFocusRequest req;
    private boolean held = false;

    private final AudioManager.OnAudioFocusChangeListener listener = new AudioManager.OnAudioFocusChangeListener() {
        @Override
        public void onAudioFocusChange(int change) {
            String type;
            if (change == AudioManager.AUDIOFOCUS_GAIN) type = "gain";
            else if (change == AudioManager.AUDIOFOCUS_LOSS) { type = "loss"; held = false; }
            else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) type = "transient";
            else if (change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK) type = "duck";
            else return;
            JSObject o = new JSObject();
            o.put("type", type);
            notifyListeners("focus", o, true);
        }
    };

    @Override
    public void load() {
        am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (am == null) { call.reject("No audio service"); return; }
        boolean speech = Boolean.TRUE.equals(call.getBoolean("speech", false));
        int r;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                AudioAttributes aa = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(speech ? AudioAttributes.CONTENT_TYPE_SPEECH : AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                if (req != null) am.abandonAudioFocusRequest(req);
                // willPauseWhenDucked: the app gets the "duck" event and decides (lower a song, pause a podcast)
                req = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(aa)
                        .setWillPauseWhenDucked(true)
                        .setOnAudioFocusChangeListener(listener)
                        .build();
                r = am.requestAudioFocus(req);
            } else {
                r = am.requestAudioFocus(listener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
        } catch (Exception e) {
            call.reject("Audio focus unavailable");
            return;
        }
        held = r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        JSObject o = new JSObject();
        o.put("granted", held);
        call.resolve(o);
    }

    @PluginMethod
    public void abandon(PluginCall call) {
        try {
            if (am != null) {
                if (Build.VERSION.SDK_INT >= 26) { if (req != null) am.abandonAudioFocusRequest(req); }
                else am.abandonAudioFocus(listener);
            }
        } catch (Exception e) { }
        held = false;
        call.resolve();
    }
}
