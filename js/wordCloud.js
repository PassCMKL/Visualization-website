// Merchant Word Cloud Visualization
function createWordCloud(data, containerId) {
    // Clear any existing chart
    d3.select(`#${containerId}`).html("");

    // Filter to only expenses (negative amounts)
    const expenses = data.filter(t => t.amount < 0);
    
    if (expenses.length === 0) {
        displayNoDataMessage(containerId, "No merchant data available for the selected period");
        return;
    }

    // Count merchant frequencies and sum amounts
    const merchantData = {};
    expenses.forEach(t => {
        if (!merchantData[t.merchant]) {
            merchantData[t.merchant] = {
                name: t.merchant,
                count: 0,
                totalAmount: 0,
                categories: new Set()
            };
        }
        merchantData[t.merchant].count += 1;
        merchantData[t.merchant].totalAmount += Math.abs(t.amount);
        merchantData[t.merchant].categories.add(t.category);
    });

    // Convert to array and filter out merchants with just 1 transaction
    const merchantCounts = Object.values(merchantData)
        .map(d => ({
            text: d.name,
            size: d.totalAmount, // Size based on total amount spent
            count: d.count,
            displayAmount: d.totalAmount.toFixed(2),
            categories: Array.from(d.categories)
        }));

    // Set up dimensions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const container = document.getElementById(containerId);
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

    // Add a background to make text more visible
    svg.append("rect")
        .attr("x", -width / 2)
        .attr("y", -height / 2)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f8f9fa")
        .attr("rx", 10);

    // Create tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Create a color scale based on spending amount
    const colorScale = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, d3.max(merchantCounts, d => d.size)]);

    // Create font size scale
    const fontSizeScale = d3.scaleSqrt()
        .domain([0, d3.max(merchantCounts, d => d.size)])
        .range([12, 50]);

    // Add a title to the word cloud
    svg.append("text")
        .attr("x", 0)
        .attr("y", -height / 2 + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#555")
        .text("Where You're Spending Money");

    // Prepare the cloud layout
    const layout = d3.layout.cloud()
        .size([width, height])
        .words(merchantCounts)
        .padding(5)
        .rotate(() => ~~(Math.random() * 2) * 45 - ~~(Math.random() * 2) * 45) // More varied rotation
        .fontSize(d => fontSizeScale(d.size))
        .on("end", draw);

    // Start the layout calculation
    layout.start();

    // Function to draw the word cloud
    function draw(words) {
        // Create a group for each word
        const wordGroups = svg.selectAll(".word-group")
            .data(words)
            .enter()
            .append("g")
            .attr("class", "word-group")
            .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotate})`);

        // Add the text for each word
        wordGroups.append("text")
            .style("font-size", "1px") // Start small for animation
            .style("font-family", "'Segoe UI', Arial, sans-serif")
            .style("font-weight", "bold")
            .style("fill", d => colorScale(d.size))
            .attr("text-anchor", "middle")
            .text(d => d.text)
            .transition()
            .duration(1200)
            .style("font-size", d => `${d.size}px`);

        // Add interactivity to each word
        wordGroups
            .on("mouseover", function(event, d) {
                // Highlight the word
                d3.select(this).select("text")
                    .style("filter", "drop-shadow(0 0 2px rgba(0,0,0,0.3))")
                    .style("cursor", "pointer")
                    .style("fill", "#ff6b6b");
                
                // Format categories for display
                const categoryList = d.categories.join(", ");
                
                // Calculate percentage of total expenses
                const totalExpenses = d3.sum(merchantCounts, m => m.size);
                const percentage = (d.size / totalExpenses * 100).toFixed(1);
                
                // Show rich tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                    
                tooltip.html(
                    `<div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${d.text}</div>` +
                    `<div style="font-size: 13px; margin-bottom: 8px;">Total Spent: ${d.displayAmount}</div>` +
                    `<div style="font-size: 12px;">Transactions: ${d.count}</div>` +
                    `<div style="font-size: 12px;">Categories: ${categoryList}</div>` +
                    `<div style="font-size: 12px; margin-top: 5px;">${percentage}% of expenses</div>`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                // Reset styling
                d3.select(this).select("text")
                    .style("filter", "none")
                    .style("fill", d => colorScale(d.size));
                    
                // Hide tooltip
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            });
    }
    
    // Add a legend for the cloud
    const legendData = [
        { label: "Larger text = more spending", y: 20 },
        { label: "Hover for details", y: 40 }
    ];
    
    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${-width/2 + 20}, ${-height/2 + 40})`);
        
    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", 0)
        .attr("y", d => d.y)
        .style("font-size", "11px")
        .style("fill", "#666")
        .text(d => d.label);
}

// Helper function to display a message when no data is available
function displayNoDataMessage(containerId, message) {
    const container = d3.select(`#${containerId}`);
    const dimensions = container.node().getBoundingClientRect();
    
    container.append("svg")
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .append("g")
        .attr("transform", `translate(${dimensions.width/2}, ${dimensions.height/2})`)
        .append("text")
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#7f8c8d")
        .text(message);
}// Merchant Word Cloud Visualization
function createWordCloud(data, containerId) {
    // Clear any existing chart
    d3.select(`#${containerId}`).html("");

    // Filter to only expenses (negative amounts)
    const expenses = data.filter(t => t.amount < 0);

    // Count merchant frequencies and sum amounts
    const merchantData = {};
    expenses.forEach(t => {
        if (!merchantData[t.merchant]) {
            merchantData[t.merchant] = {
                name: t.merchant,
                count: 0,
                totalAmount: 0
            };
        }
        merchantData[t.merchant].count += 1;
        merchantData[t.merchant].totalAmount += Math.abs(t.amount);
    });

    // Convert to array and filter out merchants with just 1 transaction
    const merchantCounts = Object.values(merchantData)
        .map(d => ({
            text: d.name,
            size: d.totalAmount, // Size based on total amount spent
            count: d.count,
            displayAmount: d.totalAmount.toFixed(2)
        }));

    // Set up dimensions
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };
    const container = document.getElementById(containerId);
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${width / 2 + margin.left},${height / 2 + margin.top})`);

    // Create tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Create a color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Create font size scale
    const fontSizeScale = d3.scaleSqrt()
        .domain([0, d3.max(merchantCounts, d => d.size)])
        .range([12, 50]);

    // Create the word cloud layout
    const layout = d3.layout.cloud()
        .size([width, height])
        .words(merchantCounts)
        .padding(5)
        .rotate(() => ~~(Math.random() * 2) * 90) // Rotate some words by 90 degrees
        .fontSize(d => fontSizeScale(d.size))
        .on("end", draw);

    // Start the layout
    layout.start();

    // Function to draw the word cloud
    function draw(words) {
        svg.selectAll("text")
            .data(words)
            .enter()
            .append("text")
            .style("font-size", "1px") // Start small for animation
            .style("font-family", "Impact")
            .style("fill", (d, i) => color(i))
            .attr("text-anchor", "middle")
            .attr("transform", d => `translate(${d.x},${d.y}) rotate(${d.rotate})`)
            .text(d => d.text)
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .style("fill", "#ff6b6b")
                    .style("cursor", "pointer");
                    
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 0.9);
                tooltip.html(
                    `<strong>${d.text}</strong><br>` +
                    `Total Spent: $${d.displayAmount}<br>` +
                    `Transactions: ${d.count}`
                )
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function(event, d) {
                d3.select(this).style("fill", color(merchantCounts.indexOf(d)));
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            // Add animation
            .transition()
            .duration(1200)
            .style("font-size", d => `${d.size}px`);
    }
}