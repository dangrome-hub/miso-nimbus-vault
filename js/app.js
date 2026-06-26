// js/app.js
document.addEventListener('DOMContentLoaded', () => {
    const supabase = window.supabaseClientInstance || window.supabase;
    
    // UI Elements
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const adminInstructions = document.getElementById('admin-instructions');
    const tripModal = document.getElementById('trip-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    
    const adminFormFields = document.getElementById('admin-form-fields');
    const publicTripDetails = document.getElementById('public-trip-details');
    const friendClaimSection = document.getElementById('friend-claim-section');
    const friendUnclaimSection = document.getElementById('friend-unclaim-section');
    const modalAdminActions = document.getElementById('modal-admin-actions');
    const neighborAlert = document.getElementById('neighbor-alert');
    const neighborDateFields = document.getElementById('neighbor-date-fields');
    
    const tripTitleInput = document.getElementById('trip-title');
    const tripStartDateInput = document.getElementById('trip-start-date');
    const tripEndDateInput = document.getElementById('trip-end-date');
    const tripStartTimeInput = document.getElementById('trip-start-time');
    const tripEndTimeInput = document.getElementById('trip-end-time');
    const includeNeighborsInput = document.getElementById('include-neighbors');
    const neighborStartDateInput = document.getElementById('neighbor-start-date');
    const neighborEndDateInput = document.getElementById('neighbor-end-date');
    
    const claimStartDateInput = document.getElementById('claim-start-date');
    const claimEndDateInput = document.getElementById('claim-end-date');
    const friendNameInput = document.getElementById('friend-name');
    
    const adminSaveBtn = document.getElementById('admin-save-btn');
    const friendClaimBtn = document.getElementById('friend-claim-btn');
    const friendUnclaimBtn = document.getElementById('friend-unclaim-btn');
    const deleteTripBtn = document.getElementById('delete-trip-btn');
    const tripNotesInput = document.getElementById('trip-notes');
    
    let activeTripData = null;
    let isAdmin = false;

    if (!supabase) {
        console.error("Supabase engine connection fault.");
        return;
    }

    // Toggle Neighbor UI on Switch Click
    includeNeighborsInput.addEventListener('change', () => {
        if (includeNeighborsInput.checked) {
            neighborDateFields.style.display = 'block';
            if (!neighborStartDateInput.value) neighborStartDateInput.value = tripStartDateInput.value;
            if (!neighborEndDateInput.value) neighborEndDateInput.value = tripEndDateInput.value;
        } else {
            neighborDateFields.style.display = 'none';
        }
    });

    // Sidebar Builder & Feed
    async function updateSidebarNeedsCoverList() {
        const listUncovered = document.getElementById('list-uncovered');
        const listPartial = document.getElementById('list-partial');
        const listCovered = document.getElementById('list-covered');
        if (!listUncovered || !listPartial || !listCovered) return;

        const { data: trips, error } = await supabase.from('trips').select('*').order('start_date', { ascending: true });
        if (error || !trips || trips.length === 0) {
            const emptyText = `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">No logs created.</p>`;
            listUncovered.innerHTML = emptyText; listPartial.innerHTML = emptyText; listCovered.innerHTML = emptyText;
            return;
        }

        let uncoveredHtml = '', partialHtml = '', coveredHtml = '';

        trips.forEach(trip => {
            const startFormatted = formatReadableDate(trip.start_date);
            const endFormatted = formatReadableDate(trip.end_date);
            let title = trip.title ? trip.title.trim() : 'Away Block';
            
            if (trip.include_neighbors && trip.neighbor_start_date && trip.neighbor_end_date) {
                title += ` 🏠(+34a: ${formatReadableDate(trip.neighbor_start_date)}-${formatReadableDate(trip.neighbor_end_date)})`;
            } else if (trip.include_neighbors) {
                title += ' 🏠(+34a)';
            }
            
            const dataPackage = encodeURIComponent(JSON.stringify(trip));
            const sTimeDisplay = formatTwelveHour(trip.start_time || '09:00');
            const eTimeDisplay = formatTwelveHour(trip.end_time || '18:00');
            
            let colorStyle = 'background: rgba(229,156,34,0.06); border-left: 4px solid #e59c22;';
            let badgeText = '🚨 Open';
            
            if (trip.status === 'claimed') {
                colorStyle = 'background: rgba(46,161,105,0.06); border-left: 4px solid #2ea169;';
                badgeText = `🐾 ${trip.claimed_by}`;
            } else if (trip.status === 'partial') {
                colorStyle = 'background: rgba(16,115,229,0.06); border-left: 4px solid #1073e5;';
                badgeText = '🟡 Split';
            }

            const itemCard = `
                <div class="sidebar-item" style="${colorStyle} margin-bottom: 0.75rem; padding: 0.5rem; border-radius: 6px; cursor: pointer;" onclick="window.openTripModalFromSidebar('${dataPackage}')">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <span style="font-size: 0.8rem; font-weight: 700; color: #1e293b;">${title}</span>
                        <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(0,0,0,0.05);">${badgeText}</span>
                    </div>
                    <div style="font-size: 0.75rem; color: #475569;">
                        📅 ${startFormatted} (${sTimeDisplay}) → ${endFormatted} (${eTimeDisplay})
                    </div>
                </div>
            `;

            if (trip.status === 'claimed') {
                coveredHtml += itemCard;
            } else if (trip.status === 'partial') {
                partialHtml += itemCard;
            } else {
                uncoveredHtml += itemCard;
            }
        });

        listUncovered.innerHTML = uncoveredHtml || `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">🎉 All Covered!</p>`;
        listPartial.innerHTML = partialHtml || `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">No partial splits.</p>`;
        listCovered.innerHTML = coveredHtml || `<p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">None claimed yet.</p>`;
    }

    // Expose routing function globally so sidecards can open the modal safely
    window.openTripModalFromSidebar = (encodedData) => {
        const trip = JSON.parse(decodeURIComponent(encodedData));
        window.openTripModal(trip);
    };

    // Open Modal Route Selector
    window.openTripModal = (trip = null) => {
        activeTripData = trip;
        tripModal.setAttribute('open', 'true');
        
        // Safely reset form names
        if (friendNameInput) friendNameInput.value = '';

        if (isAdmin) {
            // Admin View Layout
            adminFormFields.style.display = 'block';
            publicTripDetails.style.display = 'none';
            modalAdminActions.style.display = (trip && trip.id) ? 'block' : 'none';
            
            document.getElementById('modal-title').innerText = (trip && trip.id) ? '✏️ Edit Away Window' : '➕ Create Away Window';
            
            tripTitleInput.value = trip ? trip.title || '' : '';
            tripStartDateInput.value = trip ? trip.start_date : '';
            tripEndDateInput.value = trip ? trip.end_date : '';
            tripStartTimeInput.value = trip ? trip.start_time || '09:00' : '09:00';
            tripEndTimeInput.value = trip ? trip.end_time || '18:00' : '18:00';
            
            includeNeighborsInput.checked = trip ? !!trip.include_neighbors : false;
            if (trip && trip.include_neighbors) {
                neighborDateFields.style.display = 'block';
                neighborStartDateInput.value = trip.neighbor_start_date || '';
                neighborEndDateInput.value = trip.neighbor_end_date || '';
            } else {
                neighborDateFields.style.display = 'none';
                neighborStartDateInput.value = '';
                neighborEndDateInput.value = '';
            }
            tripNotesInput.value = trip ? trip.notes || '' : '';
        } else {
            // Friend/Public View Layout
            adminFormFields.style.display = 'none';
            publicTripDetails.style.display = 'block';
            modalAdminActions.style.display = 'none';
            
            if (!trip || !trip.start_date) {
                document.getElementById('modal-title').innerText = '🐈 Miso & Nimbus';
                document.getElementById('modal-details-text').innerHTML = 'Please click on a highlighted trip block on the calendar to see trip details or book a sitting shift.';
                friendClaimSection.style.display = 'none';
                friendUnclaimSection.style.display = 'none';
                return;
            }

            document.getElementById('modal-title').innerText = trip.title || 'Cat Sitting Needed 🐾';
            
            let notesBlock = trip.notes ? `<div style="margin-top:0.75rem; font-style:italic; border-top:1px solid #e2e8f0; padding-top:0.5rem; color:#475569;"><strong>Notes:</strong> ${trip.notes}</div>` : '';
            
            document.getElementById('modal-details-text').innerHTML = `
                <strong>Dates:</strong> ${formatReadableDate(trip.start_date)} to ${formatReadableDate(trip.end_date)}<br>
                <strong>Time Window:</strong> ${formatTwelveHour(trip.start_time)} on departure date to ${formatTwelveHour(trip.end_time)} on return day.<br>
                <strong>Status:</strong> ${trip.status === 'claimed' ? `🟢 Fully Booked by <strong>${trip.claimed_by}</strong>` : '🚨 Open for cover!' }
                ${notesBlock}
            `;

            if (trip.include_neighbors) {
                neighborAlert.style.display = 'block';
                document.getElementById('text-neighbor-start').innerText = formatReadableDate(trip.neighbor_start_date || trip.start_date);
                document.getElementById('text-neighbor-end').innerText = formatReadableDate(trip.neighbor_end_date || trip.end_date);
            } else {
                neighborAlert.style.display = 'none';
            }

            // Route Claim vs Unclaim layouts depending on database status
            if (trip.status === 'claimed') {
                friendClaimSection.style.display = 'none';
                friendUnclaimSection.style.display = 'block';
            } else {
                friendClaimSection.style.display = 'block';
                friendUnclaimSection.style.display = 'none';
                claimStartDateInput.value = trip.start_date;
                claimEndDateInput.value = trip.end_date;
                claimStartDateInput.min = trip.start_date;
                claimStartDateInput.max = trip.end_date;
                claimEndDateInput.min = trip.start_date;
                claimEndDateInput.max = trip.end_date;
            }
        }
    };

    // Close Modal Controller
    const closeModal = () => { tripModal.removeAttribute('open'); activeTripData = null; };
    closeModalBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

    // Admin Save Block Logic
    adminSaveBtn.addEventListener('click', async () => {
        const payload = {
            title: tripTitleInput.value || 'Away Block',
            start_date: tripStartDateInput.value,
            end_date: tripEndDateInput.value,
            start_time: tripStartTimeInput.value,
            end_time: tripEndTimeInput.value,
            include_neighbors: includeNeighborsInput.checked,
            neighbor_start_date: includeNeighborsInput.checked ? neighborStartDateInput.value : null,
            neighbor_end_date: includeNeighborsInput.checked ? neighborEndDateInput.value : null,
            notes: tripNotesInput.value,
            
            // Default new blocks to a DB-safe status value.
            status: (activeTripData && activeTripData.id) ? activeTripData.status : 'unclaimed',
            claimed_by: (activeTripData && activeTripData.id) ? activeTripData.claimed_by : null
        };

        if (!payload.start_date || !payload.end_date) {
            alert('Please select both your start and end dates.');
            return;
        }

        let queryError;
        if (activeTripData && activeTripData.id) {
            const { error } = await supabase.from('trips').update(payload).eq('id', activeTripData.id);
            queryError = error;
        } else {
            const { error } = await supabase.from('trips').insert([payload]);
            queryError = error;
        }

        if (queryError) {
            alert('Database Save failed: ' + queryError.message);
        } else {
            closeModal();
            updateSidebarNeedsCoverList();
            if (window.refreshCalendarData) window.refreshCalendarData();
        }
    });

    // Admin Delete Block Logic
    deleteTripBtn.addEventListener('click', async () => {
        if (!activeTripData || !activeTripData.id) return;
        if (!confirm('Are you absolutely sure you want to delete this trip window?')) return;

        const { error } = await supabase.from('trips').delete().eq('id', activeTripData.id);
        if (error) {
            alert('Error deleting block: ' + error.message);
        } else {
            closeModal();
            updateSidebarNeedsCoverList();
            if (window.refreshCalendarData) window.refreshCalendarData();
        }
    });

    // Friend CLAIM Logic
    friendClaimBtn.addEventListener('click', async () => {
        const friendName = friendNameInput.value.trim();
        if (!friendName) {
            alert('Please enter your name to book this shift!');
            return;
        }

        const chosenStart = claimStartDateInput.value;
        const chosenEnd = claimEndDateInput.value;
        
        let targetStatus = 'claimed';
        if (chosenStart > activeTripData.start_date || chosenEnd < activeTripData.end_date) {
            targetStatus = 'partial'; 
        }

        const { error } = await supabase.from('trips')
            .update({
                status: targetStatus,
                claimed_by: friendName,
            })
            .eq('id', activeTripData.id);

        if (error) {
            alert('Booking could not be verified: ' + error.message);
            return;
        }

        const selectedSyncMethod = document.querySelector('input[name="sync-method"]:checked').value;
        if (selectedSyncMethod === 'intent') {
            triggerGoogleCalendarWebIntent(activeTripData, friendName);
        } else {
            triggerOAuthCalendarInsertion(activeTripData, friendName);
        }

        closeModal();
        updateSidebarNeedsCoverList();
        if (window.refreshCalendarData) window.refreshCalendarData();
    });

    // Friend UNCLAIM/CANCEL Logic
    friendUnclaimBtn.addEventListener('click', async () => {
        if (!confirm('Confirm you want to cancel this shift? This will reopen the slot for other friends immediately.')) return;

        const { error } = await supabase.from('trips')
            .update({
                status: 'uncovered',
                claimed_by: null
            })
            .eq('id', activeTripData.id);

        if (error) {
            alert('Could not cancel shift: ' + error.message);
        } else {
            alert('Shift canceled successfully. Thank you!');
            closeModal();
            updateSidebarNeedsCoverList();
            if (window.refreshCalendarData) window.refreshCalendarData();
        }
    });

    // Option B: Google Calendar Direct URL generation helper
    function triggerGoogleCalendarWebIntent(trip, friendName) {
        const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
        const title = encodeURIComponent(`🐾 Cat Sitting for Miso & Nimbus`);
        
        const sDate = trip.start_date.replace(/-/g, '');
        const eDate = trip.end_date.replace(/-/g, '');
        const dates = `${sDate}/${eDate}`;

        let details = `Hi ${friendName}, thank you for helping out!\n\n`;
        details += `🐱 Miso & Nimbus Feeding Routine:\nCheck the main care link on the dashboard.\n`;
        if (trip.include_neighbors) {
            details += `\n🏠 NOTE: Cecil & Chutney also need care this window! See guide-cecil-chutney.html\n`;
        }
        if (trip.notes) details += `\nCustom Instructions: ${trip.notes}`;

        const url = `${base}&text=${title}&dates=${dates}&details=${encodeURIComponent(details)}&sf=true&output=xml`;
        window.open(url, '_blank');
    }

    function triggerOAuthCalendarInsertion(trip, friendName) {
        alert("Authentication initialization sequence. Option A will log into Google API and insert direct calendar details directly.");
    }

    // Auth Simulation toggles
    adminLoginBtn.addEventListener('click', () => {
        const password = prompt("Enter Admin Secure Verification Token:");
        if (password === "misonimbus") { 
            isAdmin = true;
            adminLoginBtn.style.display = 'none';
            adminLogoutBtn.style.display = 'inline-block';
            adminInstructions.style.display = 'block';
            document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
            alert("Admin session authenticated.");
        } else {
            alert("Invalid password clearance credentials.");
        }
    });

    adminLogoutBtn.addEventListener('click', () => {
        isAdmin = false;
        adminLoginBtn.style.display = 'inline-block';
        adminLogoutBtn.style.display = 'none';
        adminInstructions.style.display = 'none';
        document.dispatchEvent(new CustomEvent('authChange', { detail: { isAdmin } }));
        alert("Logged out of Admin Session.");
    });

    function formatReadableDate(dateString) {
        if (!dateString) return '';
        const options = { month: 'short', day: 'numeric' };
        const dateObj = new Date(dateString + 'T00:00:00');
        return dateObj.toLocaleDateString('en-US', options);
    }

    function formatTwelveHour(timeString) {
        if (!timeString) return '9:00 AM';
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    updateSidebarNeedsCoverList();
});