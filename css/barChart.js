// Bar Chart for Monthly Expenses by Category
function createBarChart(data, containerId) {
    // Clear any existing chart
    d3.select(`#${containerId}`).html("");

    // Filter out income transactions for expense analysis
    const expenses = data.filter(item => item.amount < 0);
    
    if (expenses.length === 0) {
        displayNoDataMessage(containerId, "No expense data available for the selected period");
        return;
    }

    // Group expenses by category and sum amounts
    const expensesByCategory = d3.rollup(
        expenses,
        v => d3.sum(v, d => Math.abs(d.amount)),
        d => d.category
    );

    // Convert to array and sort by amount descending
    const categoriesData = Array.from(expensesByCategory, ([category, amount]) => ({
        category,
        amount
    })).sort((a, b) => b.amount - a.amount);

    // Set up dimensions
    const margin = { top: 30, right: 30, bottom: 70, left: 80 };
    const container = document.getElementById(containerId);
    const width = container.clientWidth - margin.left - margin.right;
    const height = container.clientHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create x and y scales
    const x = d3.scaleBand()
        .domain(categoriesData.map(d => d.category))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(categoriesData, d => d.amount) * 1.1])
        .range([height, 0]);

    // Create color scale with a better palette
    const color = d3.scaleOrdinal()
        .domain(categoriesData.map(d => d.category))
        .range([
            "#3498db", "#2ecc71", "#f39c12", "#e74c3c", "#9b59b6", 
            "#1abc9c", "#f1c40f", "#e67e22", "#95a5a6", "#d35400",
            "#c0392b", "#16a085", "#8e44ad", "#27ae60", "#2980b9"
        ]);

    // Add horizontal grid lines
    svg.append("g")
        .attr("class", "grid")
        .call(
            d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat("")
        )
        .selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "3,3");

    // Add x-axis with styled labels
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "translate(-10,0)rotate(-45)")
        .style("text-anchor", "end")
        .style("font-size", "11px")
        .style("font-weight", "500");

    // Add styled x-axis line
    svg.select(".domain")
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1);

    // Add y-axis with dollar formatting
    svg.append("g")
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickFormat(d => `${d3.format(",.0f")(d)}`)
        )
        .selectAll("text")
        .style("font-size", "11px");

    // Add y-axis label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#555")
        .text("Expenses ($)");

    // Create tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Add bars with enhanced styling
    svg.selectAll(".bar")
        .data(categoriesData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.category))
        .attr("width", x.bandwidth())
        .attr("y", height) // Start at the bottom for animation
        .attr("height", 0) // Start with height 0 for animation
        .attr("fill", d => color(d.category))
        .attr("rx", 2) // Rounded corners
        .attr("ry", 2) // Rounded corners
        .on("mouseover", function(event, d) {
            // Highlight the bar
            d3.select(this)
                .attr("opacity", 0.8)
                .attr("stroke", "#333")
                .attr("stroke-width", 1);
                
            // Get category details
            const categoryExpenses = expenses.filter(t => t.category === d.category);
            const merchantCounts = {};
            
            categoryExpenses.forEach(t => {
                if (!merchantCounts[t.merchant]) {
                    merchantCounts[t.merchant] = 0;
                }
                merchantCounts[t.merchant] += Math.abs(t.amount);
            });
            
            // Get top 3 merchants by amount
            const topMerchants = Object.entries(merchantCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([merchant, amount]) => `${merchant}: ${amount.toFixed(2)}`)
                .join("<br>");
                
            // Calculate percentage of total expenses
            const totalAllExpenses = d3.sum(categoriesData, c => c.amount);
            const percentage = (d.amount / totalAllExpenses * 100).toFixed(1);
            
            // Show tooltip with rich information
            tooltip.transition()
                .duration(200)
                .style("opacity", 0.9);
                
            tooltip.html(
                `<div style="font-weight: bold; font-size: 14px; margin-bottom: 5px; color: ${color(d.category)}">${d.category}</div>` +
                `<div style="font-size: 13px; margin-bottom: 8px;">Total: ${d.amount.toFixed(2)}</div>` +
                `<div style="font-size: 12px; margin-bottom: 5px;">${percentage}% of total expenses</div>` +
                `<div style="font-size: 11px; border-top: 1px solid #ddd; padding-top: 5px; margin-top: 5px;">` +
                `<span style="font-weight: bold;">Top merchants:</span><br>${topMerchants}</div>`
            )
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .attr("opacity", 1)
                .attr("stroke", "none");
                
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        // Add animation
        .transition()
        .duration(800)
        .attr("y", d => y(d.amount))
        .attr("height", d => height - y(d.amount));

    // Add value labels on top of bars
    svg.selectAll(".label")
        .data(categoriesData)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("x", d => x(d.category) + x.bandwidth() / 2)
        .attr("y", d => y(d.amount) - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("opacity", 0) // Start invisible for animation
        .text(d => `${d3.format(",.0f")(d.amount)}`)
        .transition()
        .delay(800)
        .duration(500)
        .style("opacity", 1); // Fade in after bars animation
        
    // Add a title to the chart
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#555")
        .text("Expenses by Category");
}

// Helper function to display a message when no data is available
function displayNoDataMessage(containerId, message) {
    const container = d3.select(`#${containerId}`);
    const dimensions = container.node().getBoundingClientRect();
    
    container.append("svg")
        .attr("width", dimensions.width)
        .attr("height", dimensions.height)
        .append("text")
        .attr("x", dimensions.width / 2)
        .attr("y", dimensions.height / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#7f8c8d")
        .text(message);
}