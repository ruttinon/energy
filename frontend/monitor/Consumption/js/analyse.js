const API_URL = "/data/readings.json";
let chart;

async function fetchData() {
  try {
    const res = await fetch(API_URL + "?t=" + Date.now(), { cache: "no-store" });
    const json = await res.json();

    // 🔧 แปลง object → array เพื่อใช้งานง่าย
    const arr = Object.keys(json).map(k => ({
      time: json[k].timestamp || "-",
      Ea_plus: (json[k].Consumed_kWh || 0) * 1000,   // Wh
      Er_plus: (json[k].Generated_kWh || 0) * 1000,  // Wh
      Es: (json[k].ActivePower_Total || 0) * 1000,   // VA
    }));

    console.log("📊 Consumption records:", arr);
    return arr;
  } catch (err) {
    console.error("❌ โหลดข้อมูลไม่สำเร็จ:", err);
    return [];
  }
}

function renderChart(data, type) {
  if (!data.length) {
    console.warn("⚠ ไม่มีข้อมูลให้แสดงในกราฟ");
    return;
  }

  const ctx = document.getElementById("chartCanvas").getContext("2d");

  // 🧩 แยกข้อมูลตามเดือน
  const grouped = {};
  data.forEach(r => {
    const month = new Date(r.time).toLocaleString("en-US", { month: "long", year: "numeric" });
    grouped[month] = (grouped[month] || 0) + (r[type] || 0);
  });

  const labels = Object.keys(grouped);
  const values = Object.values(grouped);

  const total = values.reduce((a, b) => a + b, 0);
  const avg = total / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: `${type} (Wh)`,
          data: values,
          borderWidth: 1,
          backgroundColor: "rgba(37, 99, 235, 0.7)",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Monthly Consumption - ${type}`,
          font: { size: 16 },
        },
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y.toLocaleString()} Wh`,
          },
        },
        annotation: {
          annotations: {
            avgLine: {
              type: "line",
              yMin: avg,
              yMax: avg,
              borderColor: "black",
              borderWidth: 1.5,
              label: {
                display: true,
                content: `Avg: ${avg.toFixed(2)} Wh`,
                position: "start",
              },
            },
            minPoint: {
              type: "point",
              xValue: labels[values.indexOf(min)],
              yValue: min,
              backgroundColor: "green",
              radius: 6,
              label: { content: "Min", enabled: true, position: "end" },
            },
            maxPoint: {
              type: "point",
              xValue: labels[values.indexOf(max)],
              yValue: max,
              backgroundColor: "red",
              radius: 6,
              label: { content: "Max", enabled: true, position: "end" },
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "Wh" },
        },
        x: {
          title: { display: true, text: "Month" },
        },
      },
    },
  });

  // 🧮 สรุปผล
  document.getElementById("summary").innerHTML = `
    <b>Total over the period:</b> ${total.toLocaleString()} Wh<br>
    <b>Average over the period:</b> ${avg.toFixed(2)} Wh
  `;

  document.getElementById("from").textContent = data[0]?.time || "-";
  document.getElementById("to").textContent = data[data.length - 1]?.time || "-";
}

async function init() {
  const data = await fetchData();
  let type = "Ea_plus";

  renderChart(data, type);

  document.querySelectorAll(".btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      type = btn.dataset.type;
      renderChart(data, type);
    });
  });
}

init();
