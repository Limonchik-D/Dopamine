using Dopamine.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace Dopamine.Controllers
{
    public class HomeController : Controller
    {
        private readonly IWebHostEnvironment _env;

        public HomeController(IWebHostEnvironment env)
        {
            _env = env;
        }

        public IActionResult Index()
        {
            if (_env.IsDevelopment())
                return Redirect("http://localhost:5173");

            ViewBag.ProductionUrl = "https://dopamine.limonmilion2007.workers.dev";
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
    }
}
