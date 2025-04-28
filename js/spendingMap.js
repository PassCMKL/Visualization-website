// Spending Map Visualization
function createSpendingMap(data, containerId) {
    // Clear any existing chart
    d3.select(`#${containerId}`).html("");

    // Filter to only transactions with valid coordinates and negative amounts (expenses)
    const geoTransactions = data.filter(t => 
        t.amount < 0 && 
        t.location && 
        t.location.lat !== null && 
        t.location.lng !== null
    );

    // Group transactions by location
    const locationSums = {};
    geoTransactions.forEach(t => {
        const locKey = `${t.location.lat},${t.location.lng}`;
        if (!locationSums[locKey]) {
            locationSums[locKey] = {
                lat: t.location.lat,
                lng: t.location.lng,
                city: t.location.city,
                state: t.location.state,
                totalAmount: 0,
                transactions: []
            };
        }
        locationSums[locKey].totalAmount += Math.abs(t.amount);
        locationSums[locKey].transactions.push({
            date: t.date,
            amount: t.amount,
            merchant: t.merchant,
            category: t.category
        });
    });

    // Convert to array for D3
    const locationData = Object.values(locationSums);

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
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create projection - centered on California
    const projection = d3.geoMercator()
        .center([-119.5, 37.5]) // Centered on California
        .scale(2500)            // Zoom level for California
        .translate([width / 2, height / 2]);

    // Create path generator
    const path = d3.geoPath()
        .projection(projection);

    // Create tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Create a scale for circle radius based on spending amount
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(locationData, d => d.totalAmount) || 1])
        .range([8, 40]);

    // Create a color scale for the circles
    const colorScale = d3.scaleSequential(d3.interpolateReds)
        .domain([0, d3.max(locationData, d => d.totalAmount) || 1]);

    // Add a background rectangle
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f8f9fa");

    // Load US states data, but only show California
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
        .then(function(us) {
            try {
                // Filter to only California
                const california = topojson.feature(us, us.objects.states).features
                    .filter(d => d.id === "06"); // California FIPS code
                    
                // Draw California
                svg.append("g")
                    .selectAll("path")
                    .data(california)
                    .enter()
                    .append("path")
                    .attr("fill", "#f0f0f0")
                    .attr("stroke", "#ccc")
                    .attr("stroke-width", 0.7)
                    .attr("d", path);
                
                // Try to draw counties, but with error handling
                try {
                    // Add county borders for more detail (only if us.objects.counties exists)
                    if (us.objects.counties) {
                        const californiaCounties = topojson.mesh(
                            us, 
                            us.objects.counties, 
                            (a, b) => a !== b && 
                                a.id && b.id && 
                                a.id.toString().substring(0, 2) === "06" && 
                                b.id.toString().substring(0, 2) === "06"
                        );
                        
                        if (californiaCounties) {
                            svg.append("path")
                                .datum(californiaCounties)
                                .attr("fill", "none")
                                .attr("stroke", "#ddd")
                                .attr("stroke-width", 0.5)
                                .attr("d", path);
                        }
                    }
                } catch (countyError) {
                    console.warn("Could not render county borders:", countyError);
                    // Continue with the rest of the visualization
                }
                
                // Add city labels for major California cities
                const majorCities = [
                    { name: "San Francisco", coordinates: [-122.4194, 37.7749] },
                    { name: "Los Angeles", coordinates: [-118.2437, 34.0522] },
                    { name: "San Diego", coordinates: [-117.1611, 32.7157] },
                    { name: "Sacramento", coordinates: [-121.4944, 38.5816] },
                    { name: "San Jose", coordinates: [-121.8853, 37.3382] }
                ];
                
                svg.selectAll(".city-label")
                    .data(majorCities)
                    .enter()
                    .append("text")
                    .attr("class", "city-label")
                    .attr("x", d => projection(d.coordinates)[0])
                    .attr("y", d => projection(d.coordinates)[1] - 10)
                    .attr("text-anchor", "middle")
                    .style("font-size", "10px")
                    .style("font-weight", "500")
                    .style("fill", "#666")
                    .text(d => d.name);

                // Add spending circles with increased spacing
                svg.selectAll(".spending-circle")
                    .data(locationData)
                    .enter()
                    .append("circle")
                    .attr("class", "spending-circle")
                    .attr("cx", d => projection([d.lng, d.lat])[0])
                    .attr("cy", d => projection([d.lng, d.lat])[1])
                    .attr("r", 0) // Start with radius 0 for animation
                    .attr("fill", d => colorScale(d.totalAmount))
                    .attr("fill-opacity", 0.7)
                    .attr("stroke", "#fff")
                    .attr("stroke-width", 1)
                    .on("mouseover", function(event, d) {
                        d3.select(this)
                            .attr("stroke", "#333")
                            .attr("stroke-width", 2);
                            
                        // Format the transaction list for tooltip
                        let transactionList = d.transactions
                            .sort((a, b) => new Date(b.date) - new Date(a.date))
                            .slice(0, 3) // Show only the most recent 3 transactions
                            .map(t => `${t.date}: $${Math.abs(t.amount).toFixed(2)} at ${t.merchant}`)
                            .join("<br>");
                            
                        tooltip.transition()
                            .duration(200)
                            .style("opacity", 0.9);
                        tooltip.html(
                            `<strong>${d.city}, ${d.state}</strong><br>` +
                            `Total Spent: $${d.totalAmount.toFixed(2)}<br>` +
                            `<small>Recent Transactions:<br>${transactionList}</small>`
                        )
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                    })
                    .on("mouseout", function() {
                        d3.select(this)
                            .attr("stroke", "#fff")
                            .attr("stroke-width", 1);
                        tooltip.transition()
                            .duration(500)
                            .style("opacity", 0);
                    })
                    // Add animation
                    .transition()
                    .duration(1000)
                    .delay((d, i) => i * 100)
                    .attr("r", d => radiusScale(d.totalAmount));

                // Add map title
                svg.append("text")
                    .attr("x", 20)
                    .attr("y", 30)
                    .style("font-size", "14px")
                    .style("font-weight", "bold")
                    .style("fill", "#555")
                    .text("Spending Across California");
                    
                // Add subtitle
                svg.append("text")
                    .attr("x", 20)
                    .attr("y", 50)
                    .style("font-size", "12px")
                    .style("fill", "#777")
                    .text("Circle size represents amount spent at each location");
                    
            } catch (mainError) {
                console.error("Error processing map data:", mainError);
                displayErrorMap(svg, width, height);
            }
        })
        .catch(function(error) {
            console.error("Error loading map data:", error);
            displayErrorMap(svg, width, height);
        });
        
    // Add a legend for the circle sizes
    if (locationData.length > 0) {
        const legendValues = [
            d3.min(locationData, d => d.totalAmount) || 0,
            d3.median(locationData, d => d.totalAmount) || 50,
            d3.max(locationData, d => d.totalAmount) || 100
        ];
        
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${width - 120}, ${height - 100})`);
            
        legend.append("text")
            .attr("x", 0)
            .attr("y", -15)
            .style("font-size", "11px")
            .style("font-weight", "bold")
            .text("Spending Amount");
            
        legendValues.forEach((value, i) => {
            const cy = i * 30;
            
            legend.append("circle")
                .attr("cx", 0)
                .attr("cy", cy)
                .attr("r", radiusScale(value))
                .attr("fill", colorScale(value))
                .attr("fill-opacity", 0.7)
                .attr("stroke", "#fff");
                
            legend.append("text")
                .attr("x", 45)
                .attr("y", cy + 5)
                .style("font-size", "11px")
                .text(`$${value.toFixed(0)}`);
        });
    } else {
        // Add a notice if no geographic data is available
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height / 2)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("fill", "#777")
            .text("No location data available for the selected period");
    }
}

// Helper function to display error message on the map
function displayErrorMap(svg, width, height) {
    // Clear any existing content
    svg.selectAll("*").remove();
    
    // Add a simple map outline as a fallback
    svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "#f8f9fa")
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1);
    
    // Add error message
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 - 15)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#e74c3c")
        .text("Error loading map data");
        
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height / 2 + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#777")
        .text("Spending locations are still shown");
}