#include "doomkeys.h"
#include "doomgeneric.h"

#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <sys/select.h>
#endif

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
static int g_capture_tick = 0;
static int g_capture_pending = 0;
static int g_reply_pending = 0;
static const char* g_output_ppm = NULL;
static int g_ticks_per_command = 12;
static int g_hold_ticks = 2;

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
    if (strcmp(command, "up") == 0) return KEY_UPARROW;
    if (strcmp(command, "s") == 0) return KEY_DOWNARROW;
    if (strcmp(command, "down") == 0) return KEY_DOWNARROW;
    if (strcmp(command, "a") == 0) return KEY_LEFTARROW;
    if (strcmp(command, "left") == 0) return KEY_LEFTARROW;
    if (strcmp(command, "d") == 0) return KEY_RIGHTARROW;
    if (strcmp(command, "right") == 0) return KEY_RIGHTARROW;
    if (strcmp(command, "fire") == 0) return KEY_FIRE;
    if (strcmp(command, "shoot") == 0) return KEY_FIRE;
    if (strcmp(command, "enter") == 0) return KEY_ENTER;
    if (strcmp(command, "space") == 0) return KEY_USE;
    if (strcmp(command, "use") == 0) return KEY_USE;
    if (strcmp(command, "esc") == 0) return KEY_ESCAPE;
    if (strcmp(command, "escape") == 0) return KEY_ESCAPE;
    return 0;
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

static void request_capture_at(int tick)
{
    g_capture_tick = tick;
    g_capture_pending = 1;
}

static void complete_pending_reply()
{
    if (g_reply_pending && !g_capture_pending)
    {
        printf("\nOK\n");
        fflush(stdout);
        g_reply_pending = 0;
    }
}

static void schedule_commands(char** commands, int count)
{
    int tick = g_current_tick + 1;
    int has_any = 0;

    for (int i = 0; i < count; ++i)
    {
        int command_is_space = (strcmp(commands[i], "space") == 0);
        unsigned char key = map_command(commands[i]);
        if (key == 0) continue;
        has_any = 1;

        int this_hold = g_hold_ticks;
        int this_step = g_ticks_per_command;

        if (key == KEY_UPARROW || key == KEY_DOWNARROW || key == KEY_LEFTARROW || key == KEY_RIGHTARROW)
        {
            this_hold = g_hold_ticks < 10 ? 10 : g_hold_ticks;
            this_step = g_ticks_per_command < 16 ? 16 : g_ticks_per_command;
        }

        if (key == KEY_FIRE)
        {
            this_hold = g_hold_ticks < 14 ? 14 : g_hold_ticks;
            this_step = g_ticks_per_command < 24 ? 24 : g_ticks_per_command;

            push_event(tick, 1, key);
            push_event(tick + this_hold, 0, key);
            push_event(tick + this_hold + 2, 1, key);
            push_event(tick + this_hold + 10, 0, key);
            tick += this_step;
            continue;
        }

        if (key == KEY_USE)
        {
            // Give use/open interactions enough time to register reliably in-game.
            this_hold = g_hold_ticks < 8 ? 8 : g_hold_ticks;
            this_step = g_ticks_per_command < 14 ? 14 : g_ticks_per_command;
        }

        if (command_is_space)
        {
            // Keep menu behavior (enter) while also sending in-game use.
            push_event(tick, 1, KEY_USE);
            push_event(tick + this_hold, 0, KEY_USE);
            push_event(tick, 1, KEY_ENTER);
            push_event(tick + this_hold, 0, KEY_ENTER);
            tick += this_step;
            continue;
        }

        push_event(tick, 1, key);
        push_event(tick + this_hold, 0, key);
        tick += this_step;
    }

    if (has_any)
    {
        request_capture_at(tick + 30);
    }
    else
    {
        request_capture_at(g_current_tick + 1);
    }
}

void DG_Init()
{
}

void DG_DrawFrame()
{
    g_current_tick++;
    if (g_capture_pending && g_current_tick >= g_capture_tick)
    {
        write_ppm(g_output_ppm);
        g_capture_pending = 0;
    }
}

static void trim_line(char* line)
{
    size_t len = strlen(line);
    while (len > 0 && (line[len - 1] == '\n' || line[len - 1] == '\r'))
    {
        line[len - 1] = '\0';
        len--;
    }
}

static int process_command_line(char* line)
{
    trim_line(line);

    if (strncmp(line, "STEP", 4) == 0)
    {
        if (g_reply_pending)
        {
            printf("ERR busy\n");
            fflush(stdout);
            return 1;
        }

        char* rest = line + 4;
        while (*rest && isspace((unsigned char)*rest)) rest++;

        char* commands[256];
        int count = 0;
        char* tok = strtok(rest, " \t");
        while (tok && count < 256)
        {
            for (char* p = tok; *p; ++p) *p = (char)tolower((unsigned char)*p);
            commands[count++] = tok;
            tok = strtok(NULL, " \t");
        }

        schedule_commands(commands, count);
        g_reply_pending = 1;
        return 1;
    }

    if (strcmp(line, "SNAPSHOT") == 0)
    {
        write_ppm(g_output_ppm);
        printf("\nOK\n");
        fflush(stdout);
        return 1;
    }

    if (strcmp(line, "SHUTDOWN") == 0)
    {
        printf("\nOK\n");
        fflush(stdout);
        return 0;
    }

    printf("ERR unknown_command\n");
    fflush(stdout);
    return 1;
}

#ifndef _WIN32
static int stdin_ready()
{
    fd_set read_fds;
    struct timeval timeout;
    FD_ZERO(&read_fds);
    FD_SET(STDIN_FILENO, &read_fds);
    timeout.tv_sec = 0;
    timeout.tv_usec = 0;
    return select(STDIN_FILENO + 1, &read_fds, NULL, NULL, &timeout) > 0;
}
#endif

void DG_SleepMs(uint32_t ms)
{
    usleep(ms * 1000);
}

uint32_t DG_GetTicksMs()
{
#ifdef _WIN32
    return (uint32_t)GetTickCount();
#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint32_t)(ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
#endif
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

void DG_SetWindowTitle(const char* title)
{
    (void)title;
}

int main(int argc, char** argv)
{
    const char* iwad_path = NULL;
    const char* output_path = NULL;
    int warmup_ticks = 0;

    for (int i = 1; i < argc; ++i)
    {
        if (strcmp(argv[i], "--iwad") == 0 && i + 1 < argc) iwad_path = argv[++i];
        else if (strcmp(argv[i], "--out") == 0 && i + 1 < argc) output_path = argv[++i];
        else if (strcmp(argv[i], "--ticks-per-cmd") == 0 && i + 1 < argc) g_ticks_per_command = atoi(argv[++i]);
        else if (strcmp(argv[i], "--warmup-ticks") == 0 && i + 1 < argc) warmup_ticks = atoi(argv[++i]);
        else if (strcmp(argv[i], "--hold-ticks") == 0 && i + 1 < argc) g_hold_ticks = atoi(argv[++i]);
    }

    if (!iwad_path || !output_path)
    {
        fprintf(stderr, "usage: doomgeneric_session_worker --iwad <path> --out <ppm> [--ticks-per-cmd N]\n");
        return 2;
    }

    g_output_ppm = output_path;

    char* doom_argv[] = {
        "doomgeneric_session_worker",
        "-iwad", (char*)iwad_path,
        "-nosound",
        NULL
    };
    int doom_argc = 4;
    fprintf(stderr, "doomgeneric_session_worker create_start\n");
    fflush(stderr);
    doomgeneric_Create(doom_argc, doom_argv);
    fprintf(stderr, "doomgeneric_session_worker create_done\n");
    fflush(stderr);

    for (int i = 0; i < warmup_ticks; ++i)
    {
        doomgeneric_Tick();
    }

    setvbuf(stdout, NULL, _IOLBF, 0);
    printf("\nREADY\n");
    fflush(stdout);
    char line[4096];

#ifdef _WIN32
    while (fgets(line, sizeof(line), stdin))
    {
        int keep_running = process_command_line(line);
        while (keep_running && g_reply_pending)
        {
            doomgeneric_Tick();
            complete_pending_reply();
        }
        if (!keep_running)
        {
            break;
        }
    }
#else
    int keep_running = 1;
    while (keep_running)
    {
        while (stdin_ready())
        {
            if (!fgets(line, sizeof(line), stdin))
            {
                keep_running = 0;
                break;
            }
            keep_running = process_command_line(line);
            if (!keep_running)
            {
                break;
            }
        }

        if (!keep_running)
        {
            break;
        }

        doomgeneric_Tick();
        complete_pending_reply();
    }
#endif

    free(g_events);
    return 0;
}
