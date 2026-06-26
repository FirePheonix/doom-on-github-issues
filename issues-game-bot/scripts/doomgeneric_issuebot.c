#include "doomkeys.h"
#include "doomgeneric.h"

#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

typedef struct {
    int tick;
    int pressed;
    unsigned char key;
} key_event_t;

static key_event_t* g_events = NULL;
static size_t g_event_count = 0;
static size_t g_event_capacity = 0;
static size_t g_event_index = 0;

static int g_current_tick = 0;
static int g_capture_tick = 120;
static int g_done = 0;
static const char* g_output_ppm = NULL;

static void push_event(int tick, int pressed, unsigned char key)
{
    if (g_event_count + 1 > g_event_capacity)
    {
        size_t next_capacity = g_event_capacity == 0 ? 64 : g_event_capacity * 2;
        key_event_t* next = (key_event_t*)realloc(g_events, next_capacity * sizeof(key_event_t));
        if (!next)
        {
            fprintf(stderr, "oom while allocating key events\n");
            exit(2);
        }
        g_events = next;
        g_event_capacity = next_capacity;
    }

    g_events[g_event_count].tick = tick;
    g_events[g_event_count].pressed = pressed;
    g_events[g_event_count].key = key;
    g_event_count++;
}

static unsigned char map_command(const char* command)
{
    if (strcmp(command, "w") == 0) return KEY_UPARROW;
    if (strcmp(command, "s") == 0) return KEY_DOWNARROW;
    if (strcmp(command, "a") == 0) return KEY_LEFTARROW;
    if (strcmp(command, "d") == 0) return KEY_RIGHTARROW;
    if (strcmp(command, "fire") == 0) return KEY_FIRE;
    if (strcmp(command, "enter") == 0) return KEY_ENTER;
    if (strcmp(command, "esc") == 0) return KEY_ESCAPE;
    return 0;
}

static void load_command_events(const char* command_file, int warmup_ticks, int ticks_per_command, int hold_ticks)
{
    FILE* fp = fopen(command_file, "rb");
    if (!fp)
    {
        fprintf(stderr, "unable to open command file: %s\n", command_file);
        exit(2);
    }

    char line[128];
    int tick = warmup_ticks;

    while (fgets(line, sizeof(line), fp))
    {
        size_t len = strlen(line);
        while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r'))
        {
            line[len - 1] = '\0';
            len--;
        }
        for (size_t i = 0; i < len; ++i)
        {
            line[i] = (char)tolower((unsigned char)line[i]);
        }

        if (len == 0) continue;

        unsigned char key = map_command(line);
        if (key == 0) continue;

        int this_hold = hold_ticks;
        int this_step = ticks_per_command;

        // Fire key needs a longer pulse so Doom reliably consumes it.
        if (key == KEY_FIRE)
        {
            this_hold = hold_ticks < 8 ? 8 : hold_ticks;
            this_step = ticks_per_command < 12 ? 12 : ticks_per_command;
        }

        push_event(tick, 1, key);
        push_event(tick + this_hold, 0, key);
        tick += this_step;
    }

    fclose(fp);
    g_capture_tick = tick + 30;
}

static void write_ppm(const char* path)
{
    FILE* fp = fopen(path, "wb");
    if (!fp)
    {
        fprintf(stderr, "unable to open output frame path: %s\n", path);
        return;
    }

    fprintf(fp, "P6\n%d %d\n255\n", DOOMGENERIC_RESX, DOOMGENERIC_RESY);

    for (int y = 0; y < DOOMGENERIC_RESY; ++y)
    {
        for (int x = 0; x < DOOMGENERIC_RESX; ++x)
        {
            uint32_t p = ((uint32_t*)DG_ScreenBuffer)[y * DOOMGENERIC_RESX + x];
            unsigned char rgb[3];
            rgb[0] = (unsigned char)((p >> 16) & 0xFF);
            rgb[1] = (unsigned char)((p >> 8) & 0xFF);
            rgb[2] = (unsigned char)(p & 0xFF);
            fwrite(rgb, 1, 3, fp);
        }
    }

    fclose(fp);
}

void DG_Init()
{
}

void DG_DrawFrame()
{
    g_current_tick++;

    if (!g_done && g_current_tick >= g_capture_tick)
    {
        write_ppm(g_output_ppm);
        g_done = 1;
    }
}

void DG_SleepMs(uint32_t ms)
{
    usleep(ms * 1000);
}

uint32_t DG_GetTicksMs()
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint32_t)(ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
}

int DG_GetKey(int* pressed, unsigned char* doomKey)
{
    if (g_event_index >= g_event_count)
    {
        return 0;
    }

    key_event_t ev = g_events[g_event_index];
    if (ev.tick > g_current_tick)
    {
        return 0;
    }

    g_event_index++;
    *pressed = ev.pressed;
    *doomKey = ev.key;
    return 1;
}

void DG_SetWindowTitle(const char * title)
{
    (void)title;
}

int main(int argc, char** argv)
{
    const char* command_file = NULL;
    const char* iwad_path = NULL;
    const char* output_path = NULL;
    int ticks_per_command = 8;
    int warmup_ticks = 50;
    int hold_ticks = 2;

    for (int i = 1; i < argc; ++i)
    {
        if (strcmp(argv[i], "--commands") == 0 && i + 1 < argc) command_file = argv[++i];
        else if (strcmp(argv[i], "--iwad") == 0 && i + 1 < argc) iwad_path = argv[++i];
        else if (strcmp(argv[i], "--out") == 0 && i + 1 < argc) output_path = argv[++i];
        else if (strcmp(argv[i], "--ticks-per-cmd") == 0 && i + 1 < argc) ticks_per_command = atoi(argv[++i]);
        else if (strcmp(argv[i], "--warmup-ticks") == 0 && i + 1 < argc) warmup_ticks = atoi(argv[++i]);
        else if (strcmp(argv[i], "--hold-ticks") == 0 && i + 1 < argc) hold_ticks = atoi(argv[++i]);
    }

    if (!command_file || !iwad_path || !output_path)
    {
        fprintf(stderr, "usage: doomgeneric_issuebot --commands <file> --iwad <path> --out <ppm> [--ticks-per-cmd N]\n");
        return 2;
    }

    g_output_ppm = output_path;
    load_command_events(command_file, warmup_ticks, ticks_per_command, hold_ticks);

    char* doom_argv[] = {
        "doomgeneric_issuebot",
        "-iwad", (char*)iwad_path,
        "-nosound",
        NULL
    };

    int doom_argc = 4;
    doomgeneric_Create(doom_argc, doom_argv);

    int max_ticks = g_capture_tick + 600;
    while (!g_done && g_current_tick < max_ticks)
    {
        doomgeneric_Tick();
    }

    if (!g_done)
    {
        write_ppm(g_output_ppm);
    }

    free(g_events);
    return 0;
}
