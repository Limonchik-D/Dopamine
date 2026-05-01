using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllersWithViews();

// В режиме разработки запускаем wrangler dev + vite dev параллельно
if (builder.Environment.IsDevelopment())
{
    var fitnessDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../dopamine-fitness"));
    if (!Directory.Exists(fitnessDir))
        fitnessDir = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "../dopamine-fitness"));

    if (Directory.Exists(fitnessDir))
    {
        var psi = new ProcessStartInfo("cmd.exe", $"/c npm run dev:all")
        {
            WorkingDirectory = fitnessDir,
            UseShellExecute = true,
            CreateNoWindow = false,
            WindowStyle = ProcessWindowStyle.Normal
        };
        var devProcess = Process.Start(psi);

        // Убиваем дочерний процесс при выходе
        AppDomain.CurrentDomain.ProcessExit += (_, _) =>
        {
            try { devProcess?.Kill(entireProcessTree: true); } catch { }
        };
    }
}

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
